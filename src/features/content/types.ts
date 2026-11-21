export interface PublicImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Optional search-engine overrides set in the admin. */
export interface PublicSeo {
  title?: string;
  description?: string;
  noindex: boolean;
  ogImage?: PublicImage;
}

export interface Service {
  slug: string;
  title: string;
  summary: string;
  description: string;
  deliverables: string[];
  seo?: PublicSeo;
  image?: PublicImage;
  isDemo: boolean;
}

export interface CaseStudy {
  slug: string;
  title: string;
  category: string;
  summary: string;
  challenge: string;
  approach: string;
  features: string[];
  stack: string[];
  /** Only real, verified results. Leave empty until you have evidence. */
  outcomes: string[];
  serviceSlug?: string;
  seo?: PublicSeo;
  image?: PublicImage;
  isDemo: boolean;
}

export interface ProcessStep {
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  /** Rich text (the same small formatting language as the editor). */
  answer: string;
  isDemo: boolean;
  position?: number;
}

/** A block as the website draws it: images are already looked up, addresses already checked. */
export type PublicBlock =
  | { type: "richtext"; text: string }
  | { type: "image"; image: PublicImage; caption?: string }
  | { type: "steps"; heading?: string; items: { title: string; description: string }[] }
  | { type: "technologies"; heading?: string; items: string[] }
  | { type: "cta"; heading: string; text?: string; buttonLabel: string; buttonHref: string };

export interface Article {
  slug: string;
  title: string;
  summary: string;
  category: string;
  author?: string;
  image?: PublicImage;
  blocks: PublicBlock[];
  /** ISO dates, or null when unknown (a preview of a draft). */
  publishedAt: string | null;
  updatedAt: string | null;
  readingMinutes: number;
  seo?: PublicSeo;
}

export interface CmsPage {
  slug: string;
  title: string;
  summary: string;
  blocks: PublicBlock[];
  updatedAt: string | null;
  seo?: PublicSeo;
}
