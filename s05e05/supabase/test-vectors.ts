import { insertDocumentWithEmbedding, searchSimilarDocuments, supabase } from './client';

async function testVectors() {
  try {
    console.log('Rozpoczynam test wektorów...');

    // Wyczyść tabelę przed testem
    const { error: clearError } = await supabase
      .from('documents')
      .delete()
      .eq('metadata->source', 'test');

    if (clearError) {
      throw clearError;
    }

    // Test dodawania dokumentu
    const testContent = "To jest testowy fragment tekstu z notatnika Rafała o podróżach w czasie.";
    const metadata = {
      source: 'test',
      type: 'diary',
      chunkIndex: 0,
      totalChunks: 1,
      date: new Date().toISOString()
    };

    await insertDocumentWithEmbedding(testContent, metadata);
    console.log('✓ Test dodawania dokumentu: OK');

    // Sprawdź czy dokument został dodany
    const { data: docs, error: selectError } = await supabase
      .from('documents')
      .select('*')
      .eq('metadata->source', 'test');

    if (selectError) throw selectError;

    if (!docs || docs.length === 0) {
      throw new Error('Nie znaleziono dodanego dokumentu');
    }

    console.log('✓ Test odczytu dokumentu: OK');

    // Test wyszukiwania
    const results = await searchSimilarDocuments("podróże w czasie", 3, 0.5);
    console.log('\nTest wyszukiwania podobnych dokumentów:');
    
    if (results.length > 0) {
      results.forEach((doc, i) => {
        console.log(`\n${i + 1}. Podobieństwo: ${doc.similarity.toFixed(2)}`);
        console.log(`Treść: ${doc.content}`);
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