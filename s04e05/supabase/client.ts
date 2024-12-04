import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Brak wymaganych zmiennych środowiskowych SUPABASE_URL lub SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  }
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  return response.data[0].embedding;
}

export async function insertDocumentWithEmbedding(
  content: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const embedding = await createEmbedding(content);
    const { error } = await supabase.from('documents').insert({
      content,
      embedding,
      metadata
    });

    if (error) throw error;
    console.log('Dokument został pomyślnie dodany z wektorem embedingu');
  } catch (error) {
    console.error('Błąd podczas dodawania dokumentu:', error);
    throw error;
  }
}

export async function searchSimilarDocuments(
  queryText: string,
  limit: number = 5,
  similarityThreshold: number = 0.7
): Promise<any[]> {
  try {
    const queryEmbedding = await createEmbedding(queryText);
    
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: limit
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Błąd podczas wyszukiwania podobnych dokumentów:', error);
    throw error;
  }
} 