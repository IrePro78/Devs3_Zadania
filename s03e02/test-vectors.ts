import { insertDocumentWithEmbedding, searchSimilarDocuments } from './supabase-client';

async function testVectors() {
  try {
    // Test dodawania dokumentu
    await insertDocumentWithEmbedding(
      "OpenAI jest firmą zajmującą się sztuczną inteligencją.",
      { source: "test", category: "AI" }
    );

    // Test wyszukiwania podobnych dokumentów
    const similarDocs = await searchSimilarDocuments("Czym zajmuje się OpenAI?");
    console.log('Znalezione podobne dokumenty:', similarDocs);
  } catch (error) {
    console.error('Błąd podczas testowania:', error);
  }
}

testVectors().catch(console.error); 