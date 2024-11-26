import { searchSimilarDocuments } from './supabase-client';

async function searchReports() {
  try {
    const query = "W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?";
    console.log(`Wyszukuję: "${query}"`);

    const results = await searchSimilarDocuments(query, 1, 0.5); // limit 1, próg podobieństwa 0.5

    if (results && results.length > 0) {
      console.log('\nZnaleziony dokument:');
      console.log('Tytuł:', results[0].metadata.title);
      console.log('Data:', results[0].metadata.date);
      console.log('Podobieństwo:', results[0].similarity.toFixed(4));
      console.log('\nFragment tekstu:');
      console.log(results[0].content.substring(0, 500) + '...');
    } else {
      console.log('Nie znaleziono pasujących dokumentów');
    }
  } catch (error) {
    console.error('Błąd podczas wyszukiwania:', error);
  }
}

searchReports().catch(console.error); 