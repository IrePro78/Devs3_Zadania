import { supabase } from './supabase-client';
import { readFileSync } from 'fs';
import { join } from 'path';

async function initializeDatabase() {
  try {
    const sqlContent = readFileSync(join(__dirname, 'init.sql'), 'utf8');
    
    // Wykonaj każde polecenie SQL osobno
    const commands = sqlContent.split(';').filter(cmd => cmd.trim());
    
    for (const command of commands) {
      if (command.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: command });
        if (error) {
          console.error('Błąd podczas wykonywania SQL:', error);
          throw error;
        }
      }
    }
    
    console.log('Baza danych została zainicjalizowana pomyślnie!');
  } catch (error) {
    console.error('Błąd podczas inicjalizacji bazy danych:', error);
  }
}

initializeDatabase().catch(console.error); 