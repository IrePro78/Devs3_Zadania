export interface BaseMetadata {
  filename: string;
  created_at: string;
  chunk_index: number;
  total_chunks: number;
  language: 'pl' | 'en';
  document_type: string;
  topic?: string;
  section_id?: string;
  prev_fragment_id?: string;
  next_fragment_id?: string;
  keywords?: string[];
}

export interface DocumentMetadata extends BaseMetadata {
  conversation_id?: string;
  participants?: string[];
  locations?: string[];
  dates?: string[];
  topics?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  confidential?: boolean;
} 