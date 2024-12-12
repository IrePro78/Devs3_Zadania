export interface BaseMetadata {
  filename: string;
  created_at: string;
  chunk_index: number;
  total_chunks: number;
  language: 'pl' | 'en';
  document_type: string;
}

export interface EntityMetadata {
  persons: string[];
  locations: string[];
  dates: string[];
  events: string[];
  organizations?: string[];
}

export interface TemporalMetadata {
  absolute_dates: string[];
  relative_dates: string[];
  time_periods: string[];
  time_references: string[];
}

export interface ConversationMetadata {
  conversation_id: string;
  message_index: number;
  speaker?: string;
  recipients?: string[];
  has_prev: boolean;
  has_next: boolean;
}

export interface DocumentMetadata extends BaseMetadata {
  // Metadane kontekstowe
  entities: EntityMetadata;
  temporal: TemporalMetadata;
  conversation?: ConversationMetadata;

  // Metadane analityczne
  topics: string[];
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  importance_score?: number;
  confidence_score?: number;

  // Metadane relacyjne
  references?: {
    linked_documents?: string[];
    external_links?: string[];
    citations?: string[];
  };

  // Metadane bezpieczeństwa
  confidential: boolean;
  access_level?: 'public' | 'private' | 'restricted';
  encryption_status?: boolean;

  // Metadane techniczne
  format?: string;
  size?: number;
  word_count?: number;
  processing_status: 'raw' | 'processed' | 'indexed';
  last_modified?: string;
  version?: string;
} 