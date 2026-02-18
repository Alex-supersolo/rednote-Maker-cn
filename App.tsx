import React, { useState, useRef, useEffect } from 'react';
import { BrandingConfig, SlideData } from './types';
import { generateSlidesFromText } from './services/geminiService';
import SlideRenderer from './components/SlideRenderer';
import Editor from './components/Editor';
import { Loader2, Download, Image as ImageIcon, Layout, Sparkles, AlertCircle, Type, Link as LinkIcon, Upload, X } from 'lucide-react';
import { toBlob } from 'html-to-image';
import JSZip from 'jszip';
import saveAs from 'file-saver';

// Default branding with placeholder logo images
const initialBranding: BrandingConfig = {
  logoText: 'Think Unlimited',
  brandName: '「超级个体研究院」',
  footerSlogan: '赋能每一个个体，成为自己的CEO',
  // Placeholder images - using simple icons to represent the logo
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', // Black infinity-like icon
  logoUrlDark: 'https://cdn-icons-png.flaticon.com/512/3135/3135768.png', // White/Light infinity-like icon
};

// Placeholder data for initial view
const placeholderSlides: SlideData[] = [
  {
    id: 'intro-cover',
    type: 'cover',
    title: '把你解决过的问题整理成商品',
    subtitle: 'Organize resolved issues into a structured system',
    category: '系统02-搞钱认知系统',
    content: ['你遇到的所有问题，都是你的财富。'],
    backgroundImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
    titleFontSize: 48,
    coverStyle: 'classic'
  }
];

function App() {
  const [inputText, setInputText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualSubtitle, setManualSubtitle] = useState('');
  
  const [slides, setSlides] = useState<SlideData[]>(placeholderSlides);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(''); 
  
  const [branding, setBranding] = useState<BrandingConfig>(initialBranding);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(slides[0].id);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for the hidden export container
  const exportRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Helper to re-calculate page numbers after add/delete
  const reindexSlides = (currentSlides: SlideData[]): SlideData[] => {
    const totalCount = currentSlides.length; // Or just content slides? Usually RedNote counts all.
    // Assuming Cover is not usually page 1 in page count, but let's count logically.
    // Actually, usually Cover is separate, and Page 1 starts after.
    // Based on previous code: Cover didn't have page numbers visible, Content did.
    // Let's count content slides only for the X/Y indicator.
    
    const contentSlides = currentSlides.filter(s => s.type !== 'cover');
    const totalContent = contentSlides.length;
    
    let contentIndex = 0;
    
    return currentSlides.map(slide => {
      if (slide.type === 'cover') {
        return { ...slide, totalPages: totalContent };
      }
      contentIndex++;
      return {
        ...slide,
        pageNumber: contentIndex,
        totalPages: totalContent
      };
    });
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const generatedSlides = await generateSlidesFromText(inputText, manualTitle, manualSubtitle);
      setSlides(generatedSlides);
      if (generatedSlides.length > 0) {
        setActiveSlideId(generatedSlides[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'logoUrlDark') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please use an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setBranding(prev => ({
          ...prev,
          [field]: event.target!.result as string
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // --- ADD / DELETE HANDLERS ---
  
  const handleDeleteSlide = (id: string) => {
    const slideIndex = slides.findIndex(s => s.id === id);
    if (slideIndex === -1) return;

    const newSlides = slides.filter(s => s.id !== id);
    const reindexed = reindexSlides(newSlides);
    setSlides(reindexed);

    // If we deleted the active slide, select the one before it, or after it
    if (activeSlideId === id) {
       const nextIndex = Math.min(slideIndex, reindexed.length - 1);
       if (reindexed[nextIndex]) {
         setActiveSlideId(reindexed[nextIndex].id);
       } else if (reindexed.length > 0) {
         setActiveSlideId(reindexed[0].id);
       } else {
         setActiveSlideId(null);
       }
    }
  };

  const handleAddSlide = (afterId: string) => {
    const index = slides.findIndex(s => s.id === afterId);
    if (index === -1) return;

    const newSlide: SlideData = {
      id: `manual-slide-${Date.now()}`,
      type: 'content',
      title: 'New Page',
      content: ['Enter your text here...'],
      category: slides[index].category, // Inherit category
    };

    const newSlides = [...slides];
    newSlides.splice(index + 1, 0, newSlide);
    
    const reindexed = reindexSlides(newSlides);
    setSlides(reindexed);
    setActiveSlideId(newSlide.id); // Switch to new slide
  };

  const handleDownloadAll = async () => {
    if (slides.length === 0) return;
    
    setIsDownloading(true);
    setDownloadStatus('Initializing...');
    console.log('[Export] Starting export process...');

    const zip = new JSZip();
    const folder = zip.folder("rednote-slides");

    const waitForFontsReady = async () => {
      const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
      if (fonts?.ready) {
        await fonts.ready;
      }
    };

    const waitForImagesReady = async (root: HTMLElement) => {
      const images = Array.from(root.querySelectorAll('img'));
      await Promise.all(images.map(async (img) => {
        if (img.complete && img.naturalWidth > 0) return;
        await new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      }));
    };
    
    // Brief delay to ensure rendering is settled
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        setDownloadStatus(`Processing ${i + 1}/${slides.length}`);
        // Give UI time to update
        await new Promise(resolve => setTimeout(resolve, 0));

        const element = exportRefs.current[slide.id];
        
        if (element) {
          try {
            console.log(`[Export] Capturing slide ${i + 1}...`);
            await waitForFontsReady();
            await waitForImagesReady(element);
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // html-to-image uses SVG foreignObject which renders much more accurately than html2canvas
            const blob = await toBlob(element, {
              quality: 0.95,
              pixelRatio: 2, // 2x resolution (Retina quality)
              backgroundColor: '#ffffff',
              // cacheBust: true, // REMOVED to avoid CORS/Fetch errors with external fonts
            });
            
            if (blob && folder) {
              const fileName = `${String(i + 1).padStart(2, '0')}_${slide.type}.png`;
              folder.file(fileName, blob);
            }
            
          } catch (e) {
            console.error(`[Export] Capture failed for slide ${slide.id}`, e);
          }
        }
      }

      setDownloadStatus('Zipping...');
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "rednote-export.zip");

    } catch (e) {
      console.error("Global download error", e);
      setError("Failed to create export.");
    } finally {
      setIsDownloading(false);
      setDownloadStatus('');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
      
      {/* 
        HIDDEN EXPORT CONTAINER 
        Rendered securely off-screen but NOT display:none.
        html-to-image needs the elements to be in the DOM.
      */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
          {slides.map((slide) => (
            <SlideRenderer 
              key={`export-${slide.id}`}
              ref={(el) => { exportRefs.current[slide.id] = el; }}
              data={slide} 
              branding={branding} 
              scale={1} // Capture at 1x CSS scale, pixelRatio 2 handles res
            />
          ))}
        </div>
      </div>

      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-rose-500 text-white p-1.5 rounded-lg">
            <Layout size={20} />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">RedNote Maker</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleDownloadAll}
            disabled={isDownloading || slides.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:bg-slate-500 transition text-sm font-semibold min-w-[160px] justify-center"
          >
            {isDownloading ? (
               <><Loader2 size={16} className="animate-spin" /> {downloadStatus}</>
            ) : (
               <><Download size={16} /> Export ZIP</>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Panel: Input & Config */}
        <div className="w-96 flex flex-col bg-white border-r border-slate-200 z-10 shadow-xl">
          <div className="p-6 flex-1 overflow-y-auto">
            
            <div className="mb-6">
               <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b flex items-center gap-2">
                 <Type size={16} /> Cover Details
               </h3>
               <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 font-semibold uppercase">Main Title</label>
                    <input 
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="e.g. 0经验转行全攻略"
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold uppercase">Subtitle</label>
                    <input 
                      value={manualSubtitle}
                      onChange={(e) => setManualSubtitle(e.target.value)}
                      placeholder="e.g. 3个月拿到Offer"
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
               </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-bold text-slate-700 mb-2">Content Body</label>
              <textarea
                className="w-full h-48 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none resize-none text-slate-600 text-sm leading-relaxed"
                placeholder="Paste your FULL article here. Start directly with the intro sentence (e.g. '我当年...'). The AI will preserve it."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !inputText.trim()}
                className="mt-4 w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white rounded-xl font-bold flex justify-center items-center gap-2 transition shadow-lg shadow-rose-200"
              >
                {isGenerating ? (
                  <><Loader2 className="animate-spin" size={18} /> Generating...</>
                ) : (
                  <><Sparkles size={18} /> Transform to Slides</>
                )}
              </button>
              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>

            <div className="mb-8">
               <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b">Global Branding</h3>
               <div className="space-y-4">
                  {/* Dark Mode Logo (For Cover) */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold uppercase flex items-center gap-1 mb-1">
                      <LinkIcon size={12}/> Logo Image (Dark BG / White)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        value={branding.logoUrlDark}
                        onChange={(e) => setBranding({...branding, logoUrlDark: e.target.value})}
                        placeholder="https://... or upload"
                        className="flex-1 p-2 bg-slate-50 border rounded text-xs font-mono truncate"
                      />
                      <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded p-2 flex items-center justify-center transition-colors" title="Upload Local Image">
                         <Upload size={16} className="text-slate-600"/>
                         <input 
                           type="file" 
                           accept="image/*" 
                           className="hidden" 
                           onChange={(e) => handleFileUpload(e, 'logoUrlDark')}
                         />
                      </label>
                      {branding.logoUrlDark && (
                         <button 
                           onClick={() => setBranding({...branding, logoUrlDark: ''})}
                           className="bg-red-50 hover:bg-red-100 border border-red-100 rounded p-2 text-red-500 transition-colors"
                           title="Clear"
                         >
                           <X size={16} />
                         </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Used on dark cover backgrounds. Recommend transparent PNG.</p>
                  </div>

                  {/* Light Mode Logo (For Content) */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold uppercase flex items-center gap-1 mb-1">
                      <LinkIcon size={12}/> Logo Image (Light BG / Black)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        value={branding.logoUrl}
                        onChange={(e) => setBranding({...branding, logoUrl: e.target.value})}
                        placeholder="https://... or upload"
                        className="flex-1 p-2 bg-slate-50 border rounded text-xs font-mono truncate"
                      />
                      <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded p-2 flex items-center justify-center transition-colors" title="Upload Local Image">
                         <Upload size={16} className="text-slate-600"/>
                         <input 
                           type="file" 
                           accept="image/*" 
                           className="hidden" 
                           onChange={(e) => handleFileUpload(e, 'logoUrl')}
                         />
                      </label>
                       {branding.logoUrl && (
                         <button 
                           onClick={() => setBranding({...branding, logoUrl: ''})}
                           className="bg-red-50 hover:bg-red-100 border border-red-100 rounded p-2 text-red-500 transition-colors"
                           title="Clear"
                         >
                           <X size={16} />
                         </button>
                      )}
                    </div>
                     <p className="text-[10px] text-slate-400 mt-1">Used on white content slides. Recommend transparent PNG.</p>
                  </div>

                  {/* Brand Name */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold uppercase">Brand Name (Top Right)</label>
                    <input 
                      value={branding.brandName}
                      onChange={(e) => setBranding({...branding, brandName: e.target.value})}
                      className="w-full mt-1 p-2 bg-slate-50 border rounded text-sm"
                    />
                  </div>
                  
                  {/* Footer */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold uppercase">Footer Slogan</label>
                    <input 
                      value={branding.footerSlogan}
                      onChange={(e) => setBranding({...branding, footerSlogan: e.target.value})}
                      className="w-full mt-1 p-2 bg-slate-50 border rounded text-sm"
                    />
                  </div>
               </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
               <h4 className="font-bold text-slate-700 text-sm mb-2">Pro Tips</h4>
               <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4">
                  <li>Use high quality photos for the cover.</li>
                  <li>Fill slides comfortably (around 200-350 words).</li>
                  <li>Use **bold** syntax in the editor for emphasis.</li>
                  <li>Upload transparent PNG logos for best results.</li>
               </ul>
            </div>

          </div>
        </div>

        {/* Middle Panel: Preview Area */}
        <div className="flex-1 bg-slate-100 overflow-y-auto p-8 flex flex-col items-center">
          <div className="flex flex-col gap-10 pb-20 w-full items-center">
            {slides.map((slide) => (
              <div 
                key={slide.id} 
                className={`relative group cursor-pointer transition-all duration-300 ${activeSlideId === slide.id ? 'z-20 scale-[1.02] ring-4 ring-rose-500 ring-offset-4 shadow-2xl' : 'z-0 hover:z-10 hover:scale-[1.01] hover:shadow-xl'}`}
                onClick={() => setActiveSlideId(slide.id)}
              >
                 {/* 
                    Interactive Preview Renderer. 
                 */}
                 <SlideRenderer 
                    data={slide} 
                    branding={branding} 
                    scale={1} 
                  />
                
                {/* Overlay Badge */}
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm z-30 pointer-events-none">
                   {slide.type === 'cover' ? 'COVER' : `PAGE ${slide.pageNumber}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Detail Editor */}
        <div className="w-80 bg-white border-l border-slate-200 z-10 shadow-xl hidden lg:flex flex-col">
          <Editor 
            slides={slides} 
            setSlides={setSlides} 
            activeSlideId={activeSlideId} 
            setActiveSlideId={setActiveSlideId}
            onDeleteSlide={handleDeleteSlide}
            onAddSlide={handleAddSlide}
          />
        </div>

      </div>
    </div>
  );
}

export default App;
