import { MarkdownIndexer } from './indexer';
import { join } from 'path';

async function indexMarkdownFile(): Promise<void> {
  try {
    const indexer = new MarkdownIndexer();
    const mdFilePath = join(process.cwd(), 'notatnik-rafala.md');
    
    console.log('Rozpoczynam indeksowanie pliku Markdown...');
    await indexer.indexFile(mdFilePath);
    console.log('Indeksowanie zakończone pomyślnie!');
  } catch (err) {
    console.error('Wystąpił błąd podczas indeksowania:', (err as Error).message);
    process.exit(1);
  }
}

// Uruchom tylko jeśli plik jest wywoływany bezpośrednio
if (require.main === module) {
  indexMarkdownFile();
} 