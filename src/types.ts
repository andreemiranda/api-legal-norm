export interface NewsItem {
  id: number | string;
  title: string;
  link: string;
  description: string;
  content: string;
  pubDate: string;
  author: string | number;
  category: string;
  sourceId?: number;
  sourceSite?: string;
  thumbnail?: string;
  imageUrl?: string;
  image?: string;
  mediaUrl?: string;
  slug?: string;
  tags?: string[];
  readTime?: number;
}

export interface CategoryItem {
  category: string;
  count: number;
  tag_count?: number;
  top_tags?: string[];
}

export interface NewsSource {
  id: number;
  category: string;
  site: string;
  type: string;
  url: string;
  active: boolean;
  originalSite?: string;
  _links?: {
    self?: {
      href: string;
    };
  };
}

export interface WeatherData {
  city: string;
  state?: string;
  country?: string;
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  conditionText: string;
  isDay: boolean;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  updatedAt: string;
}

export interface CookieConsentSettings {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  answered: boolean;
  timestamp: string;
  consentId: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  category: string;
  message: string;
  lgpdConsent: boolean;
}

export interface TitularRequestData {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  requestType: 'confirmacao' | 'acesso' | 'correcao' | 'anonimizacao' | 'portabilidade' | 'eliminacao' | 'revogacao' | 'outros';
  description: string;
  acceptedTerms: boolean;
}
