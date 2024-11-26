import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  return response.data[0].embedding;
}

// Funkcja testowa do sprawdzenia połączenia
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('books')
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