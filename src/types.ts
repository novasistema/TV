export type TimeSlotKey = 'all' | 'morning' | 'lunch' | 'afternoon' | 'evening' | 'custom';

export interface ScheduleConfig {
  enabled: boolean;
  timeSlot: TimeSlotKey;
  customStart?: string; // "09:00"
  customEnd?: string;   // "14:00"
  daysOfWeek: number[]; // 1=Mon, 2=Tue, ..., 7=Sun, 0=Sun
}

export type MediaFit = 'floating' | 'cover' | 'contain';
export type MediaType = 'image' | 'video';
export type SlideLayoutType = 'standard' | 'exclusive-logo';

export interface Slide {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor?: string;
  price: string;
  originalPrice?: string;
  highlights: string[];
  ctaText: string;
  tickerText: string;
  mediaType: MediaType;
  mediaUrl: string;
  mediaCutoutUrl?: string;
  useCutout: boolean;
  mediaFit: MediaFit;
  duration: number; // in seconds
  useCustomDuration: boolean;
  schedule: ScheduleConfig;
  templateId: string;
  active: boolean;
  order: number;
  category?: string;
  // Exclusive Logo / Diapositiva Libre properties
  layoutType?: SlideLayoutType;
  logoScale?: number; // 20 to 100 percent
  logoFit?: 'contain' | 'cover';
  hideHeader?: boolean;
  hideTicker?: boolean;
  showHaloGlow?: boolean;
  showSubtitleUnderLogo?: boolean;
  exclusiveBgType?: 'template' | 'pure-black' | 'radial-glow';
  // Typography scaling for TV
  fontSizeScale?: 'standard' | 'large' | 'huge' | 'massive';
  // Slide-specific audio or jingle (optional)
  audioUrl?: string;
  audioTrackName?: string;
}

export interface Template {
  id: string;
  name: string;
  categoryName: string;
  description: string;
  theme: 'dark-luxury' | 'gourmet-warm' | 'cyber-neon' | 'fresh-minimal' | 'flash-sale' | 'boutique-pastel';
  layout: 'split-left' | 'split-right' | 'hero-floating' | 'modern-card' | 'banner-split';
  bgGradient: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  priceColor: string;
  fontHeading: string;
  fontBody: string;
  cardBorder: string;
  transitionEffect: 'fade' | 'slide' | 'zoom' | 'flip';
}

export interface GlobalSettings {
  storeName: string;
  storeTagline: string;
  storeLogoUrl?: string;
  defaultDuration: number; // seconds
  loop: boolean;
  transitionSpeed: number; // seconds for transition
  transitionEffect: 'fade' | 'slide' | 'zoom' | 'flip';
  showProgressBar: boolean;
  showClock: boolean;
  showWeather: boolean;
  weatherCity: string;
  weatherTemp: string;
  weatherCondition: string;
  showTicker: boolean;
  globalTickerText: string;
  tickerSpeed: number; // seconds for full marquee pass
  defaultTemplateId: string;
  orientation: 'landscape' | 'portrait';
  timeSimulationMode: boolean;
  simulatedHour: number; // 0 to 23
  simulatedMinute: number; // 0 to 59
  soundEffects: boolean;
  globalTextScale?: 'standard' | 'large' | 'huge' | 'massive';
  showStoreHeader?: boolean;
  enableBackgroundMusic?: boolean;
  musicTrackUrl?: string;
  musicTrackName?: string;
  musicVolume?: number; // 0.0 to 1.0 (e.g. 0.7)
  musicLoop?: boolean;
}

export interface CopyGenerationRequest {
  productName: string;
  category: string;
  rawDetails: string;
  tone: string;
  templateStyle: string;
  targetAudience?: string;
}

export interface GeneratedCopy {
  headline: string;
  subtitle: string;
  badge: string;
  price: string;
  originalPrice?: string;
  highlights: string[];
  ctaText: string;
  tickerText: string;
}
