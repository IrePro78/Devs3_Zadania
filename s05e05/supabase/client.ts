import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

// Sprawdź zmienne środowiskowe
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(`
    Brak wymaganych zmiennych środowiskowych:
    SUPABASE_URL: ${supabaseUrl ? 'OK' : 'BRAK'}
    SUPABASE_ANON_KEY: ${supabaseKey ? 'OK' : 'BRAK'}
  `);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// OpenAI setup
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Brak klucza OPENAI_API_KEY');
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Błąd podczas tworzenia embeddingu:', error);
    throw error;
  }
}

export async function searchSimilarDocuments(
  queryText: string,
  limit: number = 5,
  similarityThreshold: number = 0.1,
  filterType?: string
): Promise<any[]> {
  try {
    console.log('Wyszukiwanie semantyczne...');
    const queryEmbedding = await createEmbedding(queryText);
    
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: limit,
      filter_type: filterType || null
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Błąd podczas wyszukiwania:', error);
    throw error;
  }
}

export async function searchTranscripts(query: string, mediaType?: string) {
  const { data, error } = await supabase
    .rpc('search_transcripts', { 
      search_query: query,
      media_type: mediaType 
    });

  if (error) throw error;
  return data;
}

// Przykład użycia:
// const audioResults = await searchTranscripts('ważna rozmowa', 'audio');
// const imageResults = await searchTranscripts('czerwony samochód', 'image');