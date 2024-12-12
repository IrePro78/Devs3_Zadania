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

const EMBEDDING_MODEL = "text-embedding-3-large";
const CHAT_MODEL = "gpt-4o-mini";  

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const truncatedText = text.substring(0, 8000);
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,  // zawsze używaj tego samego modelu do embeddingów
      input: truncatedText
    });
    
    const embedding = response.data[0].embedding;
    
    // Sprawdź długość
    if (!Array.isArray(embedding) || embedding.length !== 3072) {
      throw new Error(`Nieprawidłowy embedding: length=${embedding?.length}, type=${typeof embedding}`);
    }
    
    return embedding;
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

interface SearchDocument {
  content: string;
  similarity: number;
  metadata?: any;
}

export async function searchWithMetadata(
  query: string,
  similarityThreshold: number = 0.1,
  limit: number = 5
): Promise<Array<SearchDocument>> {
  const embedding = await createEmbedding(query);

  const { data: documents, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: similarityThreshold,
    match_count: limit,
    filter_type: null
  });

  if (error) {
    console.error('Błąd podczas wyszukiwania:', error);
    throw error;
  }

  return documents.map((doc: SearchDocument) => ({
    content: doc.content,
    similarity: doc.similarity,
    metadata: doc.metadata
  }));
}

export async function testSearchFunction(query: string) {
  try {
    console.log('\nTest wyszukiwania...');
    console.log('Query:', query);
    
    // 1. Sprawdź embedding zapytania
    const queryEmbedding = await createEmbedding(query);
    console.log('Query embedding length:', queryEmbedding.length);
    
    // 2. Sprawdź embeddingi w bazie - bezpośrednie zapytanie
    const { data: stats, error: statsError } = await supabase
      .from('documents')
      .select(`
        id,
        content,
        embedding
      `)
      .limit(1);
      
    if (statsError) throw statsError;
    
    if (stats && stats.length > 0) {
      console.log('Database check:');
      console.log('- Sample document ID:', stats[0].id);
      console.log('- Sample content:', stats[0].content.substring(0, 100));
      console.log('- Embedding length:', stats[0].embedding?.length);
    } else {
      console.log('No documents found in database!');
    }
    
    // 3. Wykonaj wyszukiwanie z bardzo niskim progiem
    const { data, error } = await supabase.rpc('search_with_metadata', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 1,
      filter_params: {}
    });

    if (error) throw error;
    
    console.log('\nWyniki:', data?.length || 0);
    if (data && data.length > 0) {
      data.forEach((doc: SearchResult, i: number) => {
        console.log(`\nWynik ${i + 1}:`);
        console.log('Similarity:', doc.similarity);
        console.log('Content:', doc.content.substring(0, 100));
      });
    }
    
    return data;
  } catch (error) {
    console.error('Test error:', error);
    throw error;
  }
}

// Przykład użycia:
// const audioResults = await searchTranscripts('ważna rozmowa', 'audio');
// const imageResults = await searchTranscripts('czerwony samochód', 'image');

interface SearchResult {
  id: number;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}