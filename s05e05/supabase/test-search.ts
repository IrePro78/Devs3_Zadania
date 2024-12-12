import { searchWithMetadata } from './client';

interface SearchQuery {
  question: string;
}

async function testSearch() {
  const queries: SearchQuery[] = [
    { question: "Co Rafał robił w piwnicy?" },
    { question: "Jakie eksperymenty prowadził profesor?" },
    { question: "Co znaleziono w laboratorium?" },
    { question: "Kto pomógł Rafałowi?" }
  ];

  try {
    console.log('Rozpoczynam test wyszukiwania...\n');

    for (const [index, query] of queries.entries()) {
      const questionNumber = (index + 1).toString().padStart(2, '0');
      console.log(`\nPytanie ${questionNumber}: "${query.question}"`);

      const results = await searchWithMetadata(
        query.question,
        0.1,  // Niski próg podobieństwa
        3     // Mniej wyników, ale bardziej trafnych
      );
      
      if (results.length > 0) {
        results.forEach((doc, i) => {
          console.log(`\n${i + 1}. Podobieństwo: ${doc.similarity.toFixed(3)}`);
          console.log(`Treść: ${doc.content}`);
        });
      } else {
        console.log('Nie znaleziono odpowiedzi.');
      }
    }

    return true;
  } catch (error) {
    console.error('Błąd podczas wyszukiwania:', error);
    return false;
  }
}

console.log('='.repeat(80));
console.log('Test wyszukiwania semantycznego');
console.log('='.repeat(80));

testSearch()
  .then(success => {
    console.log('\nTest zakończony:', success ? 'SUKCES' : 'BŁĄD');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\nBłąd krytyczny:', error);
    process.exit(1);
  }); 