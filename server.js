import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import geoip from 'geoip-lite';
import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';

dotenv.config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
import path from 'path';
import { fileURLToPath } from 'url';

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

async function callGemini(text, systemInstruction) {
    if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: text,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ["cover", "content"] },
                        title: { type: Type.STRING },
                        subtitle: { type: Type.STRING },
                        content: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        category: { type: Type.STRING },
                        tags: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["type", "title", "content"],
                },
            },
        },
    });

    return JSON.parse(response.text() || "[]");
}

async function callDeepSeek(text, systemInstruction) {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error("Missing DEEPSEEK_API_KEY");

    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY
    });

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
    try {
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
        console.error("DeepSeek Parse Error", e);
        throw new Error("Failed to parse DeepSeek JSON");
    }
}

// --- ROUTE ---

app.post('/api/generate', async (req, res) => {
    try {
        const { text, title, subtitle } = req.body;
        if (!text) return res.status(400).json({ error: "Text is required" });

        // 1. IP Detection
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        // Handle localhost/ipv6
        const cleanIp = Array.isArray(ip) ? ip[0] : ip?.split(',')[0].trim();

        let country = 'US';
        const geo = geoip.lookup(cleanIp);
        if (geo) {
            country = geo.country;
        } else {
            // Fallback for local/private IPs (default to CN if specified in .env, or US)
            country = process.env.DEFAULT_REGION || 'US';
        }

        console.log(`[API] Request from IP: ${cleanIp}, Country: ${country}`);

        // 2. Prepare Prompt for METADATA ONLY
        const safeTitle = title || 'Main Title';
        const safeSubtitle = subtitle || 'Summary';

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
        let aiResultRaw;
        if (country === 'CN') {
            console.log("Routing to DeepSeek (CN) for Metadata...");
            try {
                aiResultRaw = await callDeepSeek(text, METADATA_INSTRUCTION);
            } catch (dsError) {
                console.error("DeepSeek failed, falling back to Gemini...", dsError);
                aiResultRaw = await callGemini(text, METADATA_INSTRUCTION);
            }
        } else {
            console.log("Routing to Gemini (Global) for Metadata...");
            aiResultRaw = await callGemini(text, METADATA_INSTRUCTION);
        }

        // Handle if AI returns array or object
        if (Array.isArray(aiResultRaw)) {
            metadata = aiResultRaw[0] || {};
        } else {
            metadata = aiResultRaw || {};
        }

        // 4. MANUAL CONTENT SPLITTING (Verbatim Mode)
        // Split by newline, filter empty
        const rawParagraphs = text.split(/\n+/).filter(line => line.trim().length > 0);

        // 5. Construct Final Slide Data
        // Slide 1: Cover
        const coverSlide = {
            type: 'cover',
            title: metadata.title || safeTitle,
            subtitle: metadata.subtitle || safeSubtitle,
            category: metadata.category || "Knowledge",
            tags: metadata.tags || ["干货"],
            content: [metadata.quote || rawParagraphs[0] || "Summary"]
        };

        // Slide 2+: Content (Verbatim Paragraphs)
        const contentSlides = rawParagraphs.map(para => ({
            type: 'content',
            title: "", // Empty for content pages
            category: coverSlide.category,
            content: [para] // Wrapping the raw verbatim paragraph
        }));

        const finalResult = [coverSlide, ...contentSlides];

        res.json(finalResult);

    } catch (error) {
        console.error("Generation Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

// --- PRODUCTION SERVE ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
