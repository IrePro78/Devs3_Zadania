import { supabase } from './client';

async function checkEmbeddings() {
  console.log('Sprawdzam embeddingi...\n');

  // Sprawdź dokumenty z embeddingami
  const { data, error } = await supabase
    .from('documents')
    .select('id, content, embedding')
    .limit(1);

  if (error) {
    console.error('Błąd:', error);
    return;
  }

  if (data && data.length > 0) {
    const doc = data[0];
    console.log('Przykładowy dokument:');
    console.log('- ID:', doc.id);
    console.log('- Content:', doc.content.substring(0, 100));
    console.log('- Embedding length:', doc.embedding?.length);
    console.log('- First 5 embedding values:', doc.embedding?.slice(0, 5));
  } else {
    console.log('Brak dokumentów z embeddingami!');
  }

  // Sprawdź ile dokumentów ma embeddingi
  const { count, error: countError } = await supabase
    .from('documents')
    .select('id', { count: 'exact' })
    .not('embedding', 'is', null);

  if (countError) {
    console.error('Błąd liczenia:', countError);
    return;
  }

  console.log('\nStatystyki:');
  console.log(`Dokumenty z embeddingami: ${count}`);
}

checkEmbeddings()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Błąd krytyczny:', error);
    process.exit(1);
  }); 