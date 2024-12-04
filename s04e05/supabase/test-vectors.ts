import { insertDocumentWithEmbedding, searchSimilarDocuments } from './client';

async function testVectors() {
  try {
    // Test dodawania dokumentu
    const testContent = "To jest testowy fragment tekstu z notatnika Rafała o podróżach w czasie.";
    const metadata = {
      source: 'test',
      type: 'diary',
      chunkIndex: 0,
      totalChunks: 1
    };

    await insertDocumentWithEmbedding(testContent, metadata);
    console.log('Test dodawania dokumentu: OK');

    // Test wyszukiwania
    const results = await searchSimilarDocuments("podróże w czasie");
    console.log('\nTest wyszukiwania:');
    results.forEach((doc, i) => {
      console.log(`\n${i + 1}. Podobieństwo: ${doc.similarity.toFixed(2)}`);
      console.log(`Treść: ${doc.content}`);
      console.log(`Metadata:`, doc.metadata);
    });

    return true;
  } catch (error) {
    console.error('Błąd podczas testowania:', error);
    return false;
  }
}

testVectors().catch(console.error); 