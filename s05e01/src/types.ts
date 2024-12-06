export interface Question {
  id: string;
  question: string;
  expectedAnswer?: string;
}

export interface Transcript {
  id: string;
  date: string;
  participants: string[];
  content: string;
}

export interface Answer {
  id: string;
  question: string;
  answer: string;
  source: string;
  confidence: number;
}

export interface Conversation {
  start: string;
  ciąg_dalszy: string[];
  end: string;
  length: number;
}

export interface Transcripts {
  [key: string]: Conversation;
} 