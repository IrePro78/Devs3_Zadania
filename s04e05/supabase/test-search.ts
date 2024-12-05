import { searchSimilarDocuments, analyzeContext } from './client';

interface SearchQuery {
  question: string;
}

async function testSearch() {
  const queries: SearchQuery[] = [
    { question: "Do którego roku przeniósł się Rafał" },
    { question: "Kto wpadł na pomysł, aby Rafał przeniósł się w czasie?" },
    { question: "Gdzie znalazł schronienie Rafał? Nazwij krótko to miejsce" },
    { question: "Którego dnia Rafał ma spotkanie z Andrzejem? (format: YYYY-MM-DD)" },
    { question: "Gdzie się chce dostać Rafał po spotkaniu z Andrzejem?" }
  ];

  try {
    const answers: Record<string, string> = {};

    for (const [index, query] of queries.entries()) {
      const questionNumber = (index + 1).toString().padStart(2, '0');
      const results = await searchSimilarDocuments(query.question, 3, 0.1);
      
      const answer = results.length > 0 
        ? await analyzeContext(results, query.question, questionNumber)
        : 'Brak informacji';

      answers[questionNumber] = answer;
    }

    console.log(JSON.stringify(answers, null, 2));
    return true;
  } catch (error) {
    console.error('Błąd podczas wyszukiwania:', error);
    return false;
  }
}

testSearch()
  .then(success => process.exit(success ? 0 : 1))
  .catch(() => process.exit(1)); 