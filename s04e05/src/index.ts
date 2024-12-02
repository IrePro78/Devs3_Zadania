import { HtmlToMarkdownConverter } from './html-to-markdown';
import { join } from 'path';
import { readdir } from 'fs/promises';

async function convertFiles(): Promise<void> {
  const converter = new HtmlToMarkdownConverter();
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
      
      await converter.convertFile({
        inputPath,
        outputPath
      });
      console.log(`Przekonwertowano ${htmlFile} na ${htmlFile.replace('.html', '.md')}`);
    }
    
    console.log('Konwersja wszystkich plików zakończona pomyślnie!');
  } catch (err) {
    console.error('Wystąpił błąd:', (err as Error).message);
    process.exit(1);
  }
}

convertFiles(); 