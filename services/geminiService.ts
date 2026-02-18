import { SlideData } from "../types";

export const generateSlidesFromText = async (rawText: string, customTitle?: string, customSubtitle?: string): Promise<SlideData[]> => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: rawText,
        title: customTitle,
        subtitle: customSubtitle
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate slides');
    }

    const generatedData = await response.json();


    // --- DOM measured pagination ---
    // Pagination decisions are based on real browser layout to minimize overflow.
    const MAX_CONTENT_HEIGHT_PX = 452;
    const SAFETY_BUFFER_PX = 18;
    const MAX_USABLE_HEIGHT = MAX_CONTENT_HEIGHT_PX - SAFETY_BUFFER_PX;

    const splitIntoSentences = (text: string): string[] => {
      const matches = text.match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g);
      return (matches || [text]).map(s => s.trim()).filter(Boolean);
    };

    const isTableBlock = (text: string): boolean => {
      const trimmed = text.trim();
      return trimmed.startsWith('|') && (trimmed.includes('|---') || trimmed.includes('| ---') || trimmed.includes('|:---'));
    };

    const createBlockElement = (text: string, isLast: boolean): HTMLDivElement => {
      const block = document.createElement('div');
      block.style.marginBottom = isLast ? '0px' : '16px';

      const trimmedBlock = text.trim();

      if (isTableBlock(trimmedBlock)) {
        const tableWrap = document.createElement('div');
        tableWrap.style.margin = '24px 0';
        tableWrap.style.width = '100%';
        tableWrap.style.overflow = 'hidden';
        tableWrap.style.border = '1px solid rgb(226 232 240)';
        tableWrap.style.borderRadius = '8px';
        block.appendChild(tableWrap);
        return block;
      }

      const lines = text.split('\n');
      const appendRichLine = (container: HTMLElement, raw: string, numbered: boolean) => {
        const parts = raw.split(/(\*\*.*?\*\*)/);
        parts.forEach((part) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const span = document.createElement('span');
            span.textContent = part.slice(2, -2);
            span.style.fontWeight = '800';
            if (numbered) {
              span.style.color = 'rgb(0 0 0)';
            } else {
              span.style.color = 'rgb(15 23 42)';
              span.style.background = 'rgba(255, 241, 242, 0.8)';
              span.style.padding = '0 4px';
              span.style.margin = '0 2px';
              span.style.borderBottom = '2px solid rgb(255 228 230)';
              span.style.borderRadius = '2px';
              span.style.display = 'inline-block';
            }
            container.appendChild(span);
          } else if (part.length > 0) {
            container.appendChild(document.createTextNode(part));
          }
        });
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          const spacer = document.createElement('div');
          spacer.style.height = '16px';
          block.appendChild(spacer);
          continue;
        }

        if (trimmed.startsWith('## ')) {
          const wrap = document.createElement('div');
          wrap.style.marginTop = '16px';
          wrap.style.marginBottom = '12px';

          const h3 = document.createElement('h3');
          h3.textContent = trimmed.replace(/^##\s+/, '');
          h3.style.margin = '0';
          h3.style.fontSize = '24px';
          h3.style.fontWeight = '900';
          h3.style.lineHeight = '1.25';
          h3.style.letterSpacing = '-0.01em';
          h3.style.color = 'rgb(15 23 42)';
          wrap.appendChild(h3);

          const bar = document.createElement('div');
          bar.style.width = '48px';
          bar.style.height = '6px';
          bar.style.marginTop = '8px';
          bar.style.borderRadius = '999px';
          bar.style.background = 'rgb(244 63 94)';
          wrap.appendChild(bar);
          block.appendChild(wrap);
          continue;
        }

        if (trimmed.startsWith('### ')) {
          const h4 = document.createElement('h4');
          h4.textContent = trimmed.replace(/^###\s+/, '');
          h4.style.margin = '16px 0 8px 0';
          h4.style.fontSize = '18px';
          h4.style.fontWeight = '900';
          h4.style.lineHeight = '1.35';
          h4.style.color = 'rgb(30 41 59)';
          block.appendChild(h4);
          continue;
        }

        const p = document.createElement('p');
        const numbered = /^\d+\./.test(trimmed);
        p.style.margin = /^\d+\./.test(trimmed) ? '0 0 4px 0' : '0 0 4px 0';
        p.style.fontSize = '15px';
        p.style.fontWeight = '500';
        p.style.lineHeight = /^\d+\./.test(trimmed) ? '1.6' : '1.5';
        p.style.letterSpacing = '0.01em';
        p.style.color = /^\d+\./.test(trimmed) ? 'rgb(30 41 59)' : 'rgb(51 65 85)';
        p.style.whiteSpace = 'pre-wrap';
        appendRichLine(p, trimmed, numbered);
        block.appendChild(p);
      }

      return block;
    };

    const createMeasureArea = (): HTMLDivElement => {
      const root = document.createElement('div');
      root.style.position = 'fixed';
      root.style.left = '-10000px';
      root.style.top = '0';
      root.style.width = '354px'; // 450 - horizontal padding(48*2)
      root.style.maxHeight = `${MAX_USABLE_HEIGHT}px`;
      root.style.overflow = 'hidden';
      root.style.boxSizing = 'border-box';
      root.style.fontFamily = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      root.style.fontSynthesisWeight = 'none';
      root.style.fontKerning = 'normal';
      root.style.textRendering = 'optimizeLegibility';
      document.body.appendChild(root);
      return root;
    };

    const measureParagraphsHeight = (measureRoot: HTMLDivElement, paragraphs: string[]): number => {
      measureRoot.innerHTML = '';
      paragraphs.forEach((p, idx) => {
        measureRoot.appendChild(createBlockElement(p, idx === paragraphs.length - 1));
      });
      return measureRoot.scrollHeight;
    };

    const canFit = (measureRoot: HTMLDivElement, paragraphs: string[]): boolean =>
      measureParagraphsHeight(measureRoot, paragraphs) <= MAX_USABLE_HEIGHT;

    const splitParagraphByMeasure = (
      measureRoot: HTMLDivElement,
      currentPage: string[],
      paragraph: string
    ): [string, string] | null => {
      const trimmed = paragraph.trim();
      if (!trimmed || trimmed.startsWith('#') || isTableBlock(trimmed)) return null;

      const sentenceParts = splitIntoSentences(trimmed);
      let parts: string[] = [];
      let joiner = '';

      if (sentenceParts.length >= 2) {
        parts = sentenceParts;
        joiner = '';
      } else {
        parts = Array.from(trimmed);
        joiner = '';
      }

      let left = 1;
      let right = parts.length - 1;
      let best = -1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const head = parts.slice(0, mid).join(joiner).trim();
        if (!head) {
          left = mid + 1;
          continue;
        }

        if (canFit(measureRoot, [...currentPage, head])) {
          best = mid;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      if (best <= 0 || best >= parts.length) return null;
      const head = parts.slice(0, best).join(joiner).trim();
      const tail = parts.slice(best).join(joiner).trim();
      if (!head || !tail) return null;
      return [head, tail];
    };

    // 1. FLATTEN ALL CONTENT from AI (Ignore AI's slide boundaries)
    let allParagraphs: string[] = [];

    generatedData.forEach((slide: any) => {
      if (slide.type === 'cover') return; // Skip cover
      if (Array.isArray(slide.content)) {
        allParagraphs.push(...slide.content);
      }
    });

    // 2. Reflow by user newlines for cleaner pagination units.
    const reflowedParagraphs: string[] = [];

    for (const para of allParagraphs) {
      if (para.startsWith('#')) {
        reflowedParagraphs.push(para);
        continue;
      }

      const lines = para.split('\n').map(line => line.trim()).filter(Boolean);

      for (const line of lines) {
        reflowedParagraphs.push(line);
      }
    }

    // 3. PAGINATE
    // Always start with Cover
    const coverSlide = generatedData.find((s: any) => s.type === 'cover') || {
      type: 'cover',
      title: customTitle || "Title",
      subtitle: customSubtitle || "Subtitle",
      content: ["Summary"],
      category: "Category"
    };
    const measureRoot = createMeasureArea();
    const paginateParagraphs = (paragraphs: string[]): string[][] => {
      const pages: string[][] = [];
      const queue = [...paragraphs];
      let currentPage: string[] = [];

      while (queue.length > 0) {
        const para = queue.shift();
        if (!para || !para.trim()) continue;

        if (canFit(measureRoot, [...currentPage, para])) {
          currentPage.push(para);
          continue;
        }

        const split = splitParagraphByMeasure(measureRoot, currentPage, para);
        if (split) {
          const [head, tail] = split;
          currentPage.push(head);
          queue.unshift(tail);
        } else {
          queue.unshift(para);
        }

        if (currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [];
        } else {
          // Fallback for one over-sized unsplittable block.
          const forced = queue.shift();
          if (forced) pages.push([forced]);
        }
      }

      if (currentPage.length > 0) {
        pages.push(currentPage);
      }

      return pages;
    };

    const pagedContent = paginateParagraphs(reflowedParagraphs);
    const normalizedSlides = pagedContent.map(content => ({
      type: 'content',
      title: '',
      content,
      category: coverSlide.category,
      tags: coverSlide.tags
    }));

    const paginatedSlides: any[] = [coverSlide, ...normalizedSlides];
    measureRoot.remove();

    const finalData = paginatedSlides;
    const totalContentSlides = finalData.length - 1; // Minus cover

    // Helper to get category from cover if missing
    const coverCategory = finalData.find((s: any) => s.type === 'cover')?.category || "Knowledge System";

    return finalData.map((slide: any, index: number) => ({
      ...slide,
      id: `slide-${Date.now()}-${index}`,
      pageNumber: index, // Cover is 0, first content is 1
      totalPages: totalContentSlides,
      // Fallback category if AI missed it on content slides
      category: slide.category || coverCategory,
      backgroundImage: slide.type === 'cover' ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop' : undefined,
      tags: slide.tags || ["干货满满", "建议收藏"],
      titleFontSize: slide.type === 'cover' ? 48 : undefined, // Default bigger font for cover
      coverStyle: slide.type === 'cover' ? 'classic' : undefined
    }));

  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};
