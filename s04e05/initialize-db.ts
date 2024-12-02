import dotenv from "dotenv";
import { data } from "./data";
import { supabase, createEmbedding } from "./supabase-client";

dotenv.config();

async function initializeData() {
  console.log("Rozpoczynam inicjalizację danych...");

  for (const book of data) {
    console.log(`Przetwarzam książkę: ${book.title} (ISBN: ${book.isbn})`);

    // Generuj embedding dla całego tekstu książki
    const combinedText = `${book.title} ${book.author} ${book.text}`;
    const embedding = await createEmbedding(combinedText);

    // Wstaw dane do bazy
    const { error } = await supabase.from("books").insert({
      isbn: book.isbn,
      author: book.author,
      title: book.title,
      text: book.text,
      embedding
    });

    if (error) {
      console.error(`Błąd podczas wstawiania książki ${book.isbn}:`, error);
    } else {
      console.log(`Pomyślnie dodano książkę: ${book.title}`);
    }
  }

  console.log("Zakończono inicjalizację danych.");
}

// Uruchom inicjalizację
initializeData()
  .catch(console.error)
  .finally(() => process.exit(0)); 