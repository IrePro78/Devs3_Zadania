import { supabase, createEmbedding } from "./supabase-client";
import dotenv from "dotenv";
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function searchByIsbn(isbn: string) {
  const { data, error } = await supabase.rpc('get_book_by_isbn', { search_isbn: isbn });
  if (error) throw error;
  console.log("\nZnaleziona książka:", data);
}

async function searchByText(phrase: string) {
  const { data, error } = await supabase.rpc('search_books', { 
    query_text: phrase, 
    match_count: 3 
  });
  if (error) throw error;
  console.log("\nTop 3 wyniki:", data);
}

async function searchSemantic(query: string) {
  try {
    console.log("Generowanie embeddingu dla zapytania...");
    const embedding = await createEmbedding(query);
    console.log("Embedding wygenerowany, długość:", embedding.length);

    // Sprawdźmy najpierw czy mamy embeddingi w bazie
    // const { data: checkData, error: checkError } = await supabase
    //   .from('books')
    //   .select('id, title, embedding')
    //   .limit(1);
    
    // console.log("Przykładowy rekord z bazy:", checkData);

    console.log("Wysyłanie zapytania do bazy...");
    const { data, error } = await supabase.rpc('match_books', {
      query_embedding: embedding,
      match_threshold: 0.1, // Zmniejszmy próg, żeby zobaczyć więcej wyników
      match_count: 10
    });

    if (error) {
      console.error("Błąd z bazy danych:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log("Nie znaleziono podobnych książek (próg podobieństwa: 0.1)");
      
      // Sprawdźmy wartości podobieństwa dla wszystkich książek
      const { data: allBooks, error: allBooksError } = await supabase
        .from('books')
        .select('id, title, embedding')
        .limit(10);

      if (allBooks) {
        console.log("\nPrzykładowe wartości podobieństwa:");
        allBooks.forEach(book => {
          const similarity = 1 - (calculateCosineSimilarity(embedding, book.embedding));
          console.log(`${book.title}: ${similarity}`);
        });
      }
      return;
    }

    console.log("\nNajbardziej podobne książki:", data);
  } catch (error) {
    console.error("Błąd podczas wyszukiwania semantycznego:", error);
    throw error;
  }
}

// Funkcja pomocnicza do obliczania podobieństwa cosinusowego
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((acc, val, i) => acc + val * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((acc, val) => acc + val * val, 0));
  const norm2 = Math.sqrt(vec2.reduce((acc, val) => acc + val * val, 0));
  return dotProduct / (norm1 * norm2);
}

async function checkEmbeddings() {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, embedding')
    .limit(1);

  if (error) {
    console.error("Błąd podczas sprawdzania embeddingów:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("Brak danych w bazie");
    return;
  }

  console.log("Przykładowy rekord:");
  console.log("Tytuł:", data[0].title);
  console.log("Długość embeddingu:", data[0].embedding.length);
  console.log("Pierwsze 5 wartości embeddingu:", data[0].embedding.slice(0, 5));
}

async function main() {
  try {
    while (true) {
      console.log("\n=== System wyszukiwania książek ===");
      console.log("1. Wyszukiwanie po ISBN");
      console.log("2. Wyszukiwanie pełnotekstowe");
      console.log("3. Wyszukiwanie semantyczne");
      console.log("4. Sprawdź embeddingi");
      console.log("5. Wyjście");

      const choice = await askQuestion("\nWybierz opcję (1-5): ");

      if (choice === "5") {
        console.log("Do widzenia!");
        break;
      }

      switch (choice) {
        case "1":
          const isbn = await askQuestion("Podaj ISBN: ");
          await searchByIsbn(isbn);
          break;

        case "2":
          const phrase = await askQuestion("Podaj frazę do wyszukania (użyj & dla AND, | dla OR): ");
          await searchByText(phrase);
          break;

        case "3":
          const query = await askQuestion("Opisz czego szukasz: ");
          await searchSemantic(query);
          break;

        case "4":
          await checkEmbeddings();
          break;

        default:
          console.log("Nieprawidłowa opcja!");
      }
    }
  } catch (error) {
    console.error("Wystąpił błąd:", error);
  } finally {
    rl.close();
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0)); 