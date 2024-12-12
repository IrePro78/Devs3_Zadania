export type Questions = string[];

export interface Question {
  content: string;
  url: string;
  sourceType?: 'phone' | 'web' | 'document';
}

export interface Answer {
  question: string;
  answer: string;
  sourceUrl: string;
}