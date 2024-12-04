import { HtmlToMarkdownConverter } from './html-to-markdown';
import { MarkdownIndexer } from './indexer';
import { join } from 'path';
import { readdir } from 'fs/promises';

async function convertAndIndexFiles(): Promise<void> {
  const converter = new HtmlToMarkdownConverter();
  const indexer = new MarkdownIndexer();
  const sourceDir = join(process.cwd(), 'source');
  const outputDir = process.cwd();
  
  try {
    const files = await readdir(sourceDir);
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    
    if (htmlFiles.length === 0) {
      console.log('Nie znaleziono plików HTML w katalogu source');
      return;
    }

    for (const htmlFile of htmlFiles) {
      const inputPath = join(sourceDir, htmlFile);
      const outputPath = join(outputDir, htmlFile.replace('.html', '.md'));
      
      // Konwertuj HTML na Markdown
      await converter.convertFile({
        inputPath,
        outputPath
      });
      
      // Zaindeksuj wygenerowany plik Markdown
      await indexer.indexFile(outputPath);
      
      console.log(`Przetworzono i zaindeksowano ${htmlFile}`);
    }
    
    console.log('Konwersja i indeksowanie zakończone pomyślnie!');
  } catch (err) {
    console.error('Wystąpił błąd:', (err as Error).message);
    process.exit(1);
  }
}

convertAndIndexFiles(); 