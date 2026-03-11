
export type SlideType = 'cover' | 'content' | 'promo';

export type CoverStyle =
  | 'classic'
  | 'immersive'
  | 'glass'
  | 'frame'
  | 'editorial'
  | 'briefing'
  | 'manifesto';

export interface SlideData {
  id: string;
  type: SlideType;
  title: string;
  content: string[]; // Array of paragraphs or bullet points
  subtitle?: string; // For cover
  category?: string; // e.g., "搞钱认知系统"
  tags?: string[]; // e.g. ["干货满满", "建议收藏"]
  pageNumber?: number;
  totalPages?: number;
  backgroundImage?: string; // URL for cover bg
  titleFontSize?: number; // Custom font size for cover title (px)
  coverStyle?: CoverStyle; // Visual variant for the cover
}

export interface BrandingConfig {
  logoText: string;
  brandName: string; // e.g. "超级个体研究院"
  footerSlogan: string; // e.g. "赋能每一个个体..."
  logoUrl: string; // URL for black/colored logo (light background)
  logoUrlDark: string; // URL for white logo (dark background)
}
