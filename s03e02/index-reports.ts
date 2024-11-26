import { insertDocumentWithEmbedding } from './supabase-client';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { ReportMetadata } from './types';

// Poprawiona ścieżka względna do katalogu z raportami
const REPORTS_DIR = join(__dirname, '.', 'do-not-share');

function extractTitleAndContent(fileContent: string): { title: string, content: string } {
  // Podziel tekst na linie
  const lines = fileContent.split('\n');
  
  // Pierwsza niepusta linia to tytuł
  const title = lines.find(line => line.trim().length > 0) || 'Brak tytułu';
  
  // Reszta tekstu to zawartość
  const content = lines.slice(lines.indexOf(title) + 1).join('\n').trim();
  
  return { title, content };
}

function extractDateFromFileName(fileName: string): string {
  const match = fileName.match(/\d{4}_\d{2}_\d{2}/);
  return match ? match[0].replace(/_/g, '-') : 'unknown';
}

async function indexReports() {
  try {
    console.log(`Szukam plików w katalogu: ${REPORTS_DIR}`);
    const files = await readdir(REPORTS_DIR);
    
    console.log(`Znaleziono ${files.length} plików`);
    
    for (const file of files) {
      if (!file.endsWith('.txt')) continue;
      
      console.log(`Przetwarzam plik: ${file}`);
      
      // Odczytaj zawartość pliku
      const fileContent = await readFile(join(REPORTS_DIR, file), 'utf-8');
      
      // Wyodrębnij tytuł i zawartość
      const { title, content } = extractTitleAndContent(fileContent);
      
      // Przygotuj metadane
      const metadata: ReportMetadata = {
        title: title.trim(),
        date: extractDateFromFileName(file)
      };
      
      console.log(`Indeksuję raport: ${metadata.title}`);
      console.log(`Data: ${metadata.date}`);
      
      // Dodaj dokument do bazy
      await insertDocumentWithEmbedding(content, metadata);
      
      // Poczekaj chwilę między requestami do API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Zakończono indeksowanie raportów');
  } catch (error) {
    console.error('Błąd podczas indeksowania raportów:', error);
    throw error; // Rzuć błąd dalej, aby zobaczyć pełny stack trace
  }
}

// Uruchom indeksowanie
indexReports().catch(console.error); 