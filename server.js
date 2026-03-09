import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'dist')));

// --- CONFIGURATION ---

const SYSTEM_INSTRUCTION = `
You are a strict text formatting engine. 
Your ONLY job is to convert the input text into a JSON array structure.

**CRITICAL RULES (VIOLATIONS = FAILURE):**
1. **VERBATIM PRESERVATION**: You MUST NOT change, summarize, edit, or rephrase a single character of the input text.
2. **NO HALLUCINATIONS**: Do NOT add any headers (like "## Introduction", "## Section 1") unless they explicitly exist in the source text.
3. **NO SUMMARIES**: Do NOT create a summary or conclusion.
4. **RAW OUTPUT**: For content slides, the \`content\` array must contain the raw input paragraphs exactly as provided.

**DATA STRUCTURE NOTATION**:
- Slide 1 (Cover):
  - type: 'cover'
  - title: "{{customTitle}}" (Use provided title or extract the very first sentence)
  - subtitle: "{{customSubtitle}}"
  - category: "Extract Category"
  - content: [] (Leave EMPTY or use a short separate summary. DO NOT consume the first paragraph here.)
- Slide 2..N (Content):
  - type: 'content'
  - title: "" (ALWAYS EMPTY for content pages)
  - category: "SAME AS COVER"
  - content: [
      "Paragraph 1 from input (MUST START HERE)...",
      "Paragraph 2 from input...",
      "Paragraph 3 from input..."
    ]

**INSTRUCTIONS**:
- Split the input text into logical paragraphs.
- If a paragraph is extremely long, you MAY split it into two strings, but DO NOT CHANGE THE TEXT.
- Return the result as a valid JSON array.
`;

// --- AI HANDLERS ---

async function callDeepSeek(text, systemInstruction) {
    const apiKey = process.env.DEEPSEEK_API_KEY ? process.env.DEEPSEEK_API_KEY.trim() : "";
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");

    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
    });

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemInstruction + "\n\nResponse MUST be a JSON array." },
                { role: "user", content: text }
            ],
            model: "deepseek-chat",
            response_format: { type: "json_object" },
        });

        // Note: DeepSeek might return an object wrapping the array or just the array string. 
        // We need to parse robustly.
        const content = completion.choices[0].message.content;
        const parsed = JSON.parse(content);

        // If it's wrapped in an object keys like { "slides": [] }, extract it.
        if (!Array.isArray(parsed)) {
            // simple heuristic
            const values = Object.values(parsed);
            if (values.length === 1 && Array.isArray(values[0])) return values[0];
            // basic fallback
            return [];
        }
        return parsed;
    } catch (e) {
        console.error("DeepSeek API Error", e);
        throw new Error("Failed to call or parse DeepSeek API");
    }
}

function normalizeTextForIntegrityCheck(input) {
    return String(input || '')
        .replace(/\r/g, '')
        // Strip common markdown control chars that may be introduced by formatter.
        .replace(/[`*_~>#\[\]\(\)]/g, '')
        .replace(/\s+/g, '');
}

function extractMarkdownParagraphsFromAiResult(aiResultRaw) {
    if (!Array.isArray(aiResultRaw)) return [];
    return aiResultRaw
        .map(item => (typeof item === 'string' ? item : ''))
        .map(item => item.trim())
        .filter(Boolean);
}

function hasMarkdownFormatting(paragraphs) {
    const markdownPattern = /(^|\n)\s{0,3}(#{1,6}\s|[-+*]\s|\d+\.\s|>\s)|\*\*[^*]+\*\*|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\)/m;
    return paragraphs.some(p => markdownPattern.test(p));
}

function splitIntoSentencesKeepingOrder(text) {
    return (text.match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g) || [text])
        .map(s => s.trim())
        .filter(Boolean);
}

function forceMarkdownFallback(rawText) {
    const blocks = String(rawText || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (blocks.length === 0) return [];

    return blocks.map(block => {
        const sentences = splitIntoSentencesKeepingOrder(block);
        if (sentences.length <= 1) return block;

        const head = `**${sentences[0]}**`;
        const body = sentences.slice(1).join('\n');
        return body ? `${head}\n${body}` : head;
    });
}

// --- ROUTE ---

app.post('/api/generate', async (req, res) => {
    try {
        const { text, title, subtitle } = req.body;
        if (!text) return res.status(400).json({ error: "Text is required" });

        console.log(`[API] Request received. Using DeepSeek for all requests.`);

        // 2. Prepare Prompt for METADATA ONLY
        const manualTitle = typeof title === 'string' ? title.trim() : '';
        const manualSubtitle = typeof subtitle === 'string' ? subtitle.trim() : '';
        const safeTitle = manualTitle || 'Main Title';
        const safeSubtitle = manualSubtitle || 'Summary';

        const METADATA_INSTRUCTION = `
You are a creative metadata generator for "Little Red Book" (Xiaohongshu).
Analyze the input text and return a JSON ARRAY containing EXACTLY ONE OBJECT with the following fields:

[
  {
    "title": "${safeTitle} (If default, generate a viral, click-worthy Title in Chinese. STRICT LIMIT: MAX 16 CHARS)",
    "subtitle": "Generate a COOL, concise subtitle in ENGLISH (Max 7 words)",
    "category": "Extract a 2-4 char category (e.g. '思维认知', '职场干货')",
    "tags": ["Tag1", "Tag2", "Tag3"],
    "quote": "Extract ONE 'Golden Sentence' (金句) that is insightful and punchy. STRICT LIMIT: MAX 20 CHINESE CHARACTERS."
  }
]

CRITICAL: 
- Return an ARRAY with ONE object.
- Quote MUST be short (<20 chars).
- Subtitle MUST be English.
`;

        let metadata; // { title, subtitle, category, tags, quote }

        // 3. Route to AI for Metadata
        // Always usage DeepSeek
        let aiResultRaw = await callDeepSeek(text, METADATA_INSTRUCTION);

        // Handle if AI returns array or object
        if (Array.isArray(aiResultRaw)) {
            metadata = aiResultRaw[0] || {};
        } else {
            metadata = aiResultRaw || {};
        }

        // 4. TEXT -> MARKDOWN FORMAT (NO TEXT MUTATION)
        const MARKDOWN_FORMAT_INSTRUCTION = `
You are a strict markdown formatter.
Your task is to format the input text into a JSON ARRAY of markdown paragraph strings.

CRITICAL RULES:
1. You MUST NOT change, delete, replace, summarize, or reorder any original text character.
2. You MAY ONLY add markdown syntax and line breaks/spaces for structure:
   - headings (#, ##, ###)
   - emphasis (**bold**, *italic*)
   - list markers (-, 1.)
   - blockquote (>)
   - separators (---)
3. Keep all original text content in the exact original sequence.
4. Do NOT invent titles, tags, or any new words.
5. Return JSON ARRAY ONLY.
`;

        let markdownParagraphs = [];
        try {
            const markdownRaw = await callDeepSeek(text, MARKDOWN_FORMAT_INSTRUCTION);
            const candidateParagraphs = extractMarkdownParagraphsFromAiResult(markdownRaw);
            const candidateJoined = candidateParagraphs.join('\n');

            const originalNormalized = normalizeTextForIntegrityCheck(text);
            const candidateNormalized = normalizeTextForIntegrityCheck(candidateJoined);

            if (candidateParagraphs.length > 0 && candidateNormalized === originalNormalized) {
                markdownParagraphs = candidateParagraphs;
            } else {
                console.warn('[API] Markdown formatting integrity check failed, fallback to raw paragraphs.');
            }
        } catch (e) {
            console.warn('[API] Markdown formatting failed, fallback to raw paragraphs.', e);
        }

        // 5. Fallback: manual paragraph splitting / forced markdown if formatter not usable.
        const rawParagraphs = text.split(/\n+/).filter(line => line.trim().length > 0);
        let contentParagraphs = markdownParagraphs.length > 0 ? markdownParagraphs : rawParagraphs;
        if (!hasMarkdownFormatting(contentParagraphs)) {
            contentParagraphs = forceMarkdownFallback(text);
        }

        // 6. Construct Final Slide Data
        // Slide 1: Cover
        const coverSlide = {
            type: 'cover',
            // User-entered title has highest priority.
            title: manualTitle || metadata.title || safeTitle,
            subtitle: manualSubtitle || metadata.subtitle || safeSubtitle,
            category: metadata.category || "Knowledge",
            tags: metadata.tags || ["干货"],
            content: [metadata.quote || rawParagraphs[0] || "Summary"]
        };

        // Slide 2+: Content (Verbatim Paragraphs)
        const contentSlides = contentParagraphs.map(para => ({
            type: 'content',
            title: "", // Empty for content pages
            category: coverSlide.category,
            content: [para] // Markdown formatted or raw fallback paragraph
        }));

        const finalResult = [coverSlide, ...contentSlides];

        res.json(finalResult);

    } catch (error) {
        console.error("Generation Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

// --- PRODUCTION SERVE ---
// Fix: Use Regex /.*/ for catch-all in Express 5 to avoid path-to-regexp error
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
