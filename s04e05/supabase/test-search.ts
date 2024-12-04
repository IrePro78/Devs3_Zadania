import { searchSimilarDocuments } from './client';

async function testSearch() {
  const queries = [
    "Co wiesz o Andrzeju?",
    "Kiedy pojawia się GPT?",
    "Co to jest Azazel?",
    "Gdzie znajduje się Grudziądz?"
  ];

  try {
    for (const query of queries) {
      console.log(`\nWyszukiwanie dla zapytania: "${query}"`);
      const results = await searchSimilarDocuments(query, 3, 0.5);
      
      console.log('Znalezione dokumenty:');
      results.forEach((doc, index) => {
        console.log(`\n${index + 1}. Podobieństwo: ${doc.similarity.toFixed(2)}`);
        console.log(`Treść: ${doc.content}`);
        console.log(`Metadata:`, doc.metadata);
      });
    }
  } catch (error) {
    console.error('Błąd podczas wyszukiwania:', error);
  }
}

testSearch().catch(console.error); 