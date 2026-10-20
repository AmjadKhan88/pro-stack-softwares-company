export interface Service {
  slug: string;
  title: string;
  summary: string;
  description: string;
  deliverables: string[];
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
  isDemo: boolean;
}

export interface ProcessStep {
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  isDemo: boolean;
}