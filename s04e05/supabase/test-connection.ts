import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'http://localhost:54321';  // URL dla lokalnej instancji
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';  // Domyślny klucz dla lokalnej instancji

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  db: {
    schema: 'public'
  }
});

async function testConnection() {
  try {
    console.log('Próba połączenia z bazą danych...');
    console.log('URL:', supabaseUrl);

    // Najpierw sprawdź podstawowe połączenie
    const { data, error } = await supabase
      .from('documents')
      .select('count')
      .single();

    if (error) {
      console.error('Błąd zapytania:', error);
      throw error;
    }

    console.log('Połączenie z Supabase działa poprawnie!');
    console.log('Dane:', data);
    return true;
  } catch (err: any) {
    console.error('Błąd połączenia z Supabase:', {
      message: err?.message || 'Nieznany błąd',
      details: err?.details || '',
      hint: err?.hint || '',
      code: err?.code || ''
    });
    return false;
  }
}

testConnection().catch(console.error); 