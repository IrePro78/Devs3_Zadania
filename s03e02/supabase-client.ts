import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interfejs dla dokumentu z wektorem
interface DocumentWithVector {
  id?: number;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

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
    return data;
  } catch (error) {
    console.error('Błąd podczas wyszukiwania podobnych dokumentów:', error);
    throw error;
  }
}

// Funkcja testowa do sprawdzenia połączenia
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('Połączenie z Supabase działa poprawnie!');
    return true;
  } catch (error) {
    console.error('Błąd połączenia z Supabase:', error);
    return false;
  }
} 