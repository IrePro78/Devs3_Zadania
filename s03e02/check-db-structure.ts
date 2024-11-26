import { supabase } from './supabase-client';

async function checkDatabaseStructure() {
  try {
    // Sprawdź czy tabela documents istnieje
    const { data: tables, error: tablesError } = await supabase
      .from('documents')
      .select('id')
      .limit(1);

    if (tablesError) {
      console.error('Błąd podczas sprawdzania tabeli documents:', tablesError);
    } else {
      console.log('Tabela documents istnieje');
    }

    // Sprawdź czy funkcja match_documents istnieje
    const { data: functions, error: functionsError } = await supabase
      .rpc('match_documents', {
        query_embedding: Array(1536).fill(0),
        match_threshold: 0.7,
        match_count: 1
      });

    if (functionsError) {
      console.error('Błąd podczas sprawdzania funkcji match_documents:', functionsError);
    } else {
      console.log('Funkcja match_documents istnieje');
    }

  } catch (error) {
    console.error('Błąd podczas sprawdzania struktury bazy danych:', error);
  }
}

checkDatabaseStructure().catch(console.error); 