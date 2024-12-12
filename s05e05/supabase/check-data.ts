import { supabase } from './client';

async function checkData() {
  console.log('Sprawdzam zawartość bazy...\n');

  // Sprawdź dokumenty źródłowe
  const { data: sources, error: sourceError } = await supabase
    .from('source_documents')
    .select('*');

  if (sourceError) throw sourceError;
  console.log(`Dokumenty źródłowe (${sources.length}):`);
  sources.forEach(doc => {
    console.log(`- ${doc.title} (${doc.document_type}): ${doc.total_chunks} chunków`);
  });

  // Sprawdź chunki
  const { data: chunks, error: chunksError } = await supabase
    .from('documents')
    .select('*');

  if (chunksError) throw chunksError;
  console.log(`\nChunki (${chunks.length}):`);
  chunks.slice(0, 3).forEach(chunk => {
    console.log('\nPrzykładowy chunk:');
    console.log('- Content:', chunk.content.substring(0, 100) + '...');
    console.log('- Metadata:', chunk.metadata);
    console.log('- Embedding length:', chunk.embedding?.length);
  });
}

checkData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Błąd:', error);
    process.exit(1);
  }); 