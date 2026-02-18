import React, { forwardRef } from 'react';
import { SlideData, BrandingConfig } from '../types';
import { MoveRight, Hash, Bookmark } from 'lucide-react';

interface SlideRendererProps {
  data: SlideData;
  branding: BrandingConfig;
  scale?: number;
}

const SlideRenderer = forwardRef<HTMLDivElement, SlideRendererProps>(({ data, branding, scale = 1 }, ref) => {

  // Standard Flexbox Layout
  const containerStyle: React.CSSProperties = {
    width: '450px',
    height: '600px',
    flexShrink: 0,
    backgroundColor: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'top left',
    boxSizing: 'border-box',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  // --- COMPONENTS ---

  // Standard Header with distinct background (Gray bg, 84px height)
  const ContentHeader = () => (
    <div className="w-full h-[84px] px-8 flex items-center justify-between shrink-0 bg-white z-20">
      <div className="flex items-center gap-3">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt="Logo" className="h-[28px] w-auto object-contain" crossOrigin="anonymous" />
        ) : (
          <span className="font-black text-sm tracking-tight text-slate-900 border-2 border-slate-900 px-1">
            {branding.logoText}
          </span>
        )}
      </div>
      <span className="text-[12px] font-bold text-slate-800 tracking-wider border-b-2 border-rose-500 pb-0.5">
        {branding.brandName}
      </span>
    </div>
  );

  const CoverHeader = ({ dark = false }: { dark?: boolean }) => {
    const logoSrc = dark ? branding.logoUrlDark : branding.logoUrl;
    return (
      <div className="flex items-center justify-between w-full h-full px-8">
        <div className="h-[28px] flex items-center">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Brand Logo"
              className="h-full w-auto object-contain max-w-[140px]"
              crossOrigin="anonymous"
            />
          ) : (
            <span className={`font-black text-lg tracking-tight ${dark ? 'text-white' : 'text-black'}`}>
              {branding.logoText}
            </span>
          )}
        </div>
        <div className="h-[28px] flex items-center">
          <span
            className="text-[14px] font-black leading-none"
            style={{ color: dark ? '#ffffff' : '#000000' }} // Pure Black/White
          >
            {branding.brandName}
          </span>
        </div>
      </div>
    );
  };

  const Footer = ({ pageInfo = false, light = false, centered = false }: { pageInfo?: boolean; light?: boolean; centered?: boolean }) => (
    <div className={`w-full px-12 shrink-0 ${light ? '' : 'bg-white'} mt-auto z-10 py-5`}>
      <div className={`pt-2 flex ${centered ? 'justify-center' : 'justify-between'} items-center`}>
        <span className={`text-[11px] font-bold tracking-[0.3em] uppercase leading-none truncate ${centered ? 'max-w-full' : 'max-w-[260px]'} ${light ? 'text-white/80' : (pageInfo ? 'text-slate-900' : 'text-slate-400')}`}>
          {pageInfo ? (data.category || branding.footerSlogan) : branding.footerSlogan}
        </span>
        {pageInfo && (
          <span className="text-slate-400 font-mono text-[11px] font-bold leading-none bg-slate-50 px-2 py-1 rounded">
            {data.pageNumber}/{data.totalPages}
          </span>
        )}
      </div>
    </div>
  );

  const renderInlineMarkdown = (line: string, variant: 'normal' | 'list' = 'normal') => {
    const tokenRegex = /(\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\)|`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_)/g;
    const parts = line.split(tokenRegex);

    return parts.map((part, i) => {
      if (!part) return null;

      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-rose-600 underline decoration-rose-300 hover:text-rose-700">
            {linkMatch[1]}
          </a>
        );
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="font-mono text-[0.92em] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }

      if ((part.startsWith('***') && part.endsWith('***')) || (part.startsWith('___') && part.endsWith('___'))) {
        return (
          <span key={i} className={variant === 'list' ? 'font-black italic text-black' : 'font-black italic text-slate-900 bg-rose-50/80 px-1 mx-0.5 rounded-sm border-b-2 border-rose-100'}>
            {part.slice(3, -3)}
          </span>
        );
      }

      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
        return (
          <span key={i} className={variant === 'list' ? 'font-extrabold text-black' : 'font-extrabold text-slate-900 bg-rose-50/80 px-1 mx-0.5 rounded-sm border-b-2 border-rose-100'}>
            {part.slice(2, -2)}
          </span>
        );
      }

      if (part.startsWith('~~') && part.endsWith('~~')) {
        return (
          <span key={i} className="line-through text-slate-400">
            {part.slice(2, -2)}
          </span>
        );
      }

      if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }

      return part;
    });
  };

  const renderParagraph = (text: string, idx: number) => {
    if (!text) return null;
    const trimmedBlock = text.trim();

    // 1. Table Logic (Block Level)
    // Check if block looks like a table (multiple lines, pipe chars)
    if (trimmedBlock.startsWith('|') && (trimmedBlock.includes('|---') || trimmedBlock.includes('| ---') || trimmedBlock.includes('|:---'))) {
      const rows = trimmedBlock.split('\n').filter(r => r.trim() !== '');
      const tableRows = rows.filter(r => !r.includes('---'));
      if (tableRows.length === 0) return null;

      return (
        <div key={idx} className="my-6 w-full overflow-hidden border border-slate-200 rounded-lg shadow-sm">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-slate-50 text-slate-900 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                {tableRows[0].split('|').filter(c => c.trim() !== '').map((cell, i) => (
                  <th key={i} className="px-3 py-2 text-center">{cell.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableRows.slice(1).map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.split('|').filter(c => c.trim() !== '').map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-600 font-medium text-center border-r border-slate-50 last:border-r-0">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // 2. Line-by-Line Rendering
    // Split block by newlines to handle "Internal Lines"
    const lines = text.split('\n');
    const renderedLines: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        renderedLines.push(<div key={`sp-${idx}-${i}`} className="h-4" />);
        i++;
        continue;
      }

      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        const lang = trimmed.replace(/^```/, '').trim();
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        renderedLines.push(
          <div key={`code-${idx}-${i}`} className="my-3 rounded-lg border border-slate-200 bg-slate-900 text-slate-100 overflow-hidden">
            {lang && <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider bg-slate-800 text-slate-300">{lang}</div>}
            <pre className="p-3 text-[12px] leading-relaxed font-mono whitespace-pre-wrap">{codeLines.join('\n')}</pre>
          </div>
        );
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        renderedLines.push(<hr key={`hr-${idx}-${i}`} className="my-3 border-slate-200" />);
        i++;
        continue;
      }

      if (trimmed.startsWith('# ')) {
        renderedLines.push(
          <div key={`h1-${idx}-${i}`} className="mt-3 mb-3">
            <h2 className="text-[28px] font-black text-slate-900 leading-tight tracking-tight">{trimmed.replace(/^#\s+/, '')}</h2>
            <div className="w-16 h-1.5 bg-rose-500 mt-2 rounded-full"></div>
          </div>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('## ')) {
        renderedLines.push(
          <div key={`h2-${idx}-${i}`} className="mt-4 mb-3">
            <h3 className="text-[24px] font-black text-slate-900 leading-tight tracking-tight">
              {trimmed.replace(/^##\s+/, '')}
            </h3>
            <div className="w-12 h-1.5 bg-rose-500 mt-2 rounded-full"></div>
          </div>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('### ')) {
        renderedLines.push(
          <h4 key={`h3-${idx}-${i}`} className="text-[18px] font-black text-slate-800 mt-4 mb-2 leading-snug flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
            {trimmed.replace(/^###\s+/, '')}
          </h4>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        renderedLines.push(
          <blockquote key={`q-${idx}-${i}`} className="my-3 border-l-4 border-rose-200 bg-rose-50/40 px-3 py-2 text-slate-700 text-[14px] leading-[1.6] italic">
            {quoteLines.map((q, qIdx) => (
              <p key={qIdx}>{renderInlineMarkdown(q)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      if (/^[-*+]\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
          i++;
        }
        renderedLines.push(
          <ul key={`ul-${idx}-${i}`} className="my-2 list-disc pl-6 text-slate-700 text-[15px] leading-[1.5] font-medium tracking-wide space-y-1">
            {items.map((item, itemIdx) => (
              <li key={itemIdx}>{renderInlineMarkdown(item, 'list')}</li>
            ))}
          </ul>
        );
        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        renderedLines.push(
          <ol key={`ol-${idx}-${i}`} className="my-2 list-decimal pl-6 text-slate-800 text-[15px] leading-[1.6] font-medium tracking-wide space-y-1">
            {items.map((item, itemIdx) => (
              <li key={itemIdx}>{renderInlineMarkdown(item, 'list')}</li>
            ))}
          </ol>
        );
        continue;
      }

      renderedLines.push(
        <p key={`p-${idx}-${i}`} className="text-slate-700 text-[15px] leading-[1.5] font-medium text-justify tracking-wide mb-1 whitespace-pre-wrap">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
      i++;
    }

    return <div key={idx} className="mb-4 last:mb-0">{renderedLines}</div>;
  };

  // --- RENDERERS BY TYPE ---

  const renderCover = () => {
    const style = data.coverStyle || 'classic';
    const titleSize = data.titleFontSize || 48;

    // --- 1. CLASSIC STYLE (Split 60/40) ---
    if (style === 'classic') {
      return (
        <div ref={ref} style={containerStyle} className="shadow-2xl">
          <div className="h-[56%] w-full relative shrink-0">
            <img
              src={data.backgroundImage || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop"}
              alt="Cover"
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-transparent to-slate-900/90 mix-blend-multiply"></div>
            <div className="absolute top-0 left-0 w-full h-[84px] pt-6 z-10">
              <CoverHeader dark />
            </div>
            <div className="absolute bottom-0 left-0 w-full px-8 pb-10 z-10 flex flex-col justify-end">
              <h1 className="font-black text-white leading-[1.15] mb-3 tracking-tight drop-shadow-lg break-words whitespace-pre-wrap" style={{ fontSize: `${titleSize}px` }}>
                {data.title}
              </h1>
              <p className="text-white/95 text-[17px] font-bold tracking-wide drop-shadow-md line-clamp-2 pr-4">{data.subtitle}</p>
            </div>
          </div>
          <div className="flex-1 bg-white relative px-8 pt-[15px] pb-0 flex flex-col">
            <div className="flex flex-wrap gap-2 mb-[15px] shrink-0">
              {data.category && (
                <div className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100">
                  <Bookmark size={12} strokeWidth={3} /><span>{data.category}</span>
                </div>
              )}
              {data.tags && data.tags.map((tag, i) => (
                <div key={i} className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold"><Hash size={12} strokeWidth={3} /><span>{tag}</span></div>
              ))}
            </div>
            <div className="relative w-full mb-1 grow flex flex-col z-20">
              <div className="bg-slate-50 rounded-2xl px-6 py-4 border border-slate-100 h-full flex flex-col justify-center relative shadow-sm min-h-[80px]">
                <div className="absolute -top-1 left-4 text-slate-200 text-[60px] font-serif leading-none select-none pointer-events-none">❝</div>
                <p className="relative z-10 text-slate-800 font-bold text-lg leading-relaxed text-center px-1">{data.content[0] || '你遇到的所有问题，都是你的财富。'}</p>

                {/* Read More Button */}
                <div className="absolute -bottom-3 right-[30px] bg-white rounded-full pl-5 pr-1.5 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.1)] flex items-center gap-2 border border-slate-100 z-30">
                  <span className="font-black text-slate-900 text-[12px] tracking-[0.2em] uppercase">Read More</span>
                  <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                    <MoveRight size={10} className="text-white" strokeWidth={3} />
                  </div>
                </div>
              </div>
            </div>
            <Footer centered />
          </div>
        </div>
      );
    }

    // --- 2. IMMERSIVE STYLE (Full Image + Dark Gradient) ---
    if (style === 'immersive') {
      return (
        <div ref={ref} style={containerStyle} className="shadow-2xl">
          <img
            src={data.backgroundImage || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop"}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
            crossOrigin="anonymous"
          />
          {/* Strong Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10"></div>

          <div className="absolute top-0 left-0 w-full h-[84px] pt-6 z-10">
            <CoverHeader dark />
          </div>

          <div className="absolute bottom-0 left-0 w-full h-full flex flex-col justify-end px-8 pb-0 z-20">
            <div className="mb-auto mt-20">
              {/* Floating Tags */}
              <div className="flex flex-wrap gap-2 opacity-90">
                {data.category && (
                  <div className="bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold border border-white/10">
                    {data.category}
                  </div>
                )}
                {data.tags?.map((tag, i) => (
                  <div key={i} className="bg-black/40 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold border border-white/10">
                    #{tag}
                  </div>
                ))}
              </div>
            </div>

            <h1 className="font-black text-white leading-[1.1] mb-4 tracking-tight drop-shadow-2xl whitespace-pre-wrap" style={{ fontSize: `${titleSize}px` }}>
              {data.title}
            </h1>
            <div className="w-16 h-2 bg-rose-500 mb-6 rounded-full"></div>

            {data.content[0] && (
              <div className="mb-8 border-l-4 border-white/60 pl-4 py-1">
                <p className="text-white/90 font-medium text-lg italic leading-relaxed">
                  “{data.content[0]}”
                </p>
              </div>
            )}

            <Footer light centered />
          </div>
        </div>
      );
    }

    // --- 3. GLASS STYLE (Full Image + Frosted Glass Card) ---
    if (style === 'glass') {
      return (
        <div ref={ref} style={containerStyle} className="shadow-2xl">
          <img
            src={data.backgroundImage || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop"}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
            crossOrigin="anonymous"
          />
          <div className="absolute inset-0 bg-black/20"></div>

          <div className="absolute top-0 left-0 w-full h-[84px] pt-6 z-10">
            <CoverHeader dark />
          </div>

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
            {/* Glass Card */}
            <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center">
              <div className="mb-6">
                <span className="bg-rose-500 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full">
                  {data.category || 'FEATURED'}
                </span>
              </div>

              <h1 className="font-black text-white leading-[1.15] mb-4 tracking-tight drop-shadow-lg whitespace-pre-wrap" style={{ fontSize: `${titleSize * 0.9}px` }}>
                {data.title}
              </h1>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/40 to-transparent my-6"></div>

              <p className="text-white/90 font-bold text-lg leading-relaxed drop-shadow-md">
                {data.content[0] || data.subtitle}
              </p>

              {/* Tags in card */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {data.tags?.map((tag, i) => (
                  <span key={i} className="text-white/70 text-xs font-mono">#{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 pb-4">
            <p className="text-center text-white/60 font-black text-[10px] uppercase tracking-[0.3em]">{branding.footerSlogan}</p>
          </div>
        </div>
      );
    }

    // --- 4. FRAME STYLE (Art Gallery Look) ---
    if (style === 'frame') {
      return (
        <div ref={ref} style={containerStyle} className="shadow-2xl bg-white p-6 flex flex-col">
          {/* Inner Frame */}
          <div className="flex-1 border border-slate-100 flex flex-col relative overflow-hidden bg-slate-50">
            {/* Image Half */}
            <div className="h-[55%] w-full relative overflow-hidden">
              <img
                src={data.backgroundImage || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop"}
                alt="Cover"
                className="w-full h-full object-cover transition-transform hover:scale-105 duration-700"
                crossOrigin="anonymous"
              />
              <div className="absolute top-4 left-4">
                <div className="bg-white/90 backdrop-blur text-slate-900 px-3 py-1 text-xs font-bold border border-slate-100 uppercase tracking-wider">
                  {data.category || 'COVER STORY'}
                </div>
              </div>
            </div>

            {/* Content Half */}
            <div className="flex-1 bg-white p-8 flex flex-col justify-center relative">
              {/* Decorative Number Removed for cleaner look */}

              <h1 className="font-black text-slate-900 leading-[1.1] mb-4 tracking-tighter whitespace-pre-wrap relative z-10" style={{ fontSize: `${titleSize}px` }}>
                {data.title}
              </h1>

              <div className="w-12 h-1 bg-slate-900 mb-6"></div>

              <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">
                {data.subtitle || data.content[0]}
              </p>

              <div className="mt-auto flex justify-between items-end border-t border-slate-100 pt-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Created By</span>
                  <span className="text-xs font-black text-slate-900">{branding.brandName}</span>
                </div>
                <div className="flex gap-2">
                  {data.tags?.slice(0, 2).map((tag, i) => (
                    <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold">#{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null; // Should not happen
  };

  if (data.type === 'cover') {
    return renderCover();
  }

  // CONTENT LAYOUT
  return (
    <div ref={ref} style={containerStyle} className="shadow-xl border border-slate-100">
      <ContentHeader />
      <div className="flex-1 px-12 pt-6 overflow-hidden relative flex flex-col bg-white">
        {data.title && (
          <div className="shrink-0 mb-6 hidden">
            <h2 className="text-[24px] font-black text-slate-900 leading-[1.2] tracking-tight">{data.title}</h2>
          </div>
        )}
        <div className="w-full">
          {data.content.map((paragraph, idx) => renderParagraph(paragraph, idx))}
        </div>
      </div>
      <Footer pageInfo />
    </div>
  );
});

SlideRenderer.displayName = 'SlideRenderer';

export default SlideRenderer;
