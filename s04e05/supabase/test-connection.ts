import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
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

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('count')
      .single();

    if (error) throw error;
    console.log('Połączenie z Supabase działa poprawnie!');
    return true;
  } catch (err) {
    console.error('Błąd połączenia z Supabase:', err);
    return false;
  }
}

// Wykonaj test i zakończ proces
testConnection()
  .then(() => process.exit(0))
  .catch(() => process.exit(1)); 