import { createEmbedding, searchSimilarDocuments, supabase } from './client';

async function testVectors() {
  try {
    console.log('Rozpoczynam test wektorów...');

    // Wyczyść tabelę przed testem
    const { error: clearError } = await supabase
      .from('source_documents')
      .delete()
      .eq('metadata->test', true);

    if (clearError) {
      throw clearError;
    }

    // Test dodawania dokumentu źródłowego z transkrypcją rozmowy
    const testContent = {
      "rozmowa1": [
        "- Hej! Jak się masz?",
        "- Dziękuję, dobrze. Co słychać?"
      ]
    };

    const sourceMetadata = {
      test: true,
      conversations: 1
    };

    // Dodaj dokument źródłowy
    const { data: sourceDoc, error: sourceError } = await supabase
      .from('source_documents')
      .insert({
        title: 'test-conversation.json',
        file_path: 'test/conversation.json',
        document_type: 'json',
        original_content: JSON.stringify(testContent),
        total_chunks: 0,
        metadata: sourceMetadata
      })
      .select()
      .single();

    if (sourceError) throw sourceError;
    console.log('✓ Test dodawania dokumentu źródłowego: OK');

    // Test dodawania fragmentu z wektorem
    const chunk = Object.values(testContent)[0].join('\n');
    const embedding = await createEmbedding(chunk);

    const { error: chunkError } = await supabase
      .from('documents')
      .insert({
        content: chunk,
        embedding,
        metadata: { chunk_index: 0, total_chunks: 1 },
        source_document_id: sourceDoc.id
      });

    if (chunkError) throw chunkError;
    console.log('✓ Test dodawania fragmentu z wektorem: OK');

    // Test wyszukiwania
    const results = await searchSimilarDocuments(
      "rozmowa telefoniczna", 
      3,
      0.5,
      'phone'
    );

    console.log('\nTest wyszukiwania podobnych dokumentów:');
    if (results.length > 0) {
      results.forEach((doc, i) => {
        console.log(`\n${i + 1}. Podobieństwo: ${doc.similarity.toFixed(2)}`);
        console.log(`Treść: ${doc.content}`);
        console.log(`Typ dokumentu: ${doc.document_type}`);
        console.log(`Metadata:`, doc.metadata);
      });
      console.log('✓ Test wyszukiwania: OK');
    } else {
      console.log('! Nie znaleziono podobnych dokumentów');
    }

    return true;
  } catch (error) {
    console.error('Błąd podczas testowania:', error);
    return false;
  }
}

testVectors().catch(console.error); 