export interface ChunkMetadata {
  filename: string;
  created_at: string;
  chunk_index: number;
  total_chunks: number;
  language: 'pl' | 'en';
  topic: string;
  keywords: string[];
  media_type?: string;
  format?: string;
}

export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
} 