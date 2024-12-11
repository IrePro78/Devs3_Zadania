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

console.log('Inicjalizacja klienta Supabase z:', {
  url: supabaseUrl,
  keyLength: supabaseKey.length
});

// Stwórz klienta z podstawową konfiguracją
export const supabase = createClient(supabaseUrl, supabaseKey);

// Test połączenia przy inicjalizacji
(async () => {
  try {
    await supabase.from('documents').select('count').single();
    console.log('✓ Połączenie z Supabase nawiązane');
  } catch (error: any) {
    console.error('✗ Błąd połączenia z Supabase:', error.message);
  }
})();

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

export async function insertDocumentWithEmbedding(
  content: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    console.log('Tworzenie embeddingu dla tekstu...');
    const embedding = await createEmbedding(content);
    
    console.log('Dodawanie dokumentu do bazy...');
    const { error } = await supabase.from('documents').insert({
      content,
      embedding,
      metadata
    });

    if (error) throw error;
    console.log('✓ Dokument został pomyślnie dodany');
  } catch (error) {
    console.error('Błąd podczas dodawania dokumentu:', error);
    throw error;
  }
}

export async function searchSimilarDocuments(
  queryText: string,
  limit: number = 5,
  similarityThreshold: number = 0.1
): Promise<any[]> {
  try {
    console.log('Wyszukiwanie semantyczne...');
    const queryEmbedding = await createEmbedding(queryText);
    
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: limit
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Błąd podczas wyszukiwania:', error);
    throw error;
  }
}

export async function analyzeContext(results: any[], queryText: string, questionNumber: string): Promise<string> {
  if (results.length === 0) return 'Brak informacji';

  const context = results.map(r => r.content).join('\n\n');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Jesteś precyzyjnym asystentem odpowiadającym na pytania.
- Odpowiadaj maksymalnie zwięźle, najlepiej jednym słowem lub datą
- Na pytanie o rok weźpod uwagę wszystkie fakty z kontekstu
- Na pytania o datę odpowiadaj w formacie YYYY-MM-DD
- Na pytania o miejsce odpowiadaj samą nazwą miejsca
- Na pytania o osobę odpowiadaj samym imieniem
- Jeśli nie ma informacji, odpowiedz "Brak informacji"
- Nie dodawaj żadnych wyjaśnień ani kontekstu
- zanim odpowiesz, zastanów się`
      },
      {
        role: "user",
        content: `Kontekst:\n${context}\n\nPytanie: ${queryText}\n\nPodaj samą odpowiedź:`
      }
    ]
  });

  return response.choices[0].message.content?.trim() || 'Błąd analizy';
} 