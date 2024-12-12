import { DocumentMetadata } from './metadata.interface';

export interface ChunkMetadata extends DocumentMetadata {
  // Dodatkowe metadane specyficzne dla fragmentu
  chunk_type: 'conversation' | 'paragraph' | 'section' | 'transcript' | 'description';
  parent_id?: string;
  sequence_number?: number;
  context_window?: {
    prev_chunks: string[];
    next_chunks: string[];
  };
}

export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];  // Opcjonalne - może być dodane później
} 