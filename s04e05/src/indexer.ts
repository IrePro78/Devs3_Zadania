import { readFile } from 'fs/promises';
import { insertDocumentWithEmbedding } from '../supabase/client';

interface IndexingOptions {
  chunkSize?: number;
  overlap?: number;
}

export class MarkdownIndexer {
  private readonly defaultOptions: Required<IndexingOptions> = {
    chunkSize: 1000,
    overlap: 200
  };

  constructor(private options: IndexingOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  private splitIntoChunks(text: string): string[] {
    const { chunkSize, overlap } = { ...this.defaultOptions, ...this.options };
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + chunkSize;
      
      // Jeśli to nie jest ostatni chunk, znajdź lepsze miejsce do podziału
      if (endIndex < text.length) {
        const nextPeriod = text.indexOf('.', endIndex - overlap);
        if (nextPeriod !== -1 && nextPeriod < endIndex + overlap) {
          endIndex = nextPeriod + 1;
        }
      }

      const chunk = text.slice(startIndex, endIndex).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      startIndex = endIndex - overlap;
    }

    return chunks;
  }

  public async indexFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      
      // Usuń obrazy z tekstu przed indeksowaniem
      const textWithoutImages = content.replace(/!\[.*?\]\([^)]+\)/g, '');
      
      // Podziel na mniejsze części
      const chunks = this.splitIntoChunks(textWithoutImages);
      
      for (const [index, chunk] of chunks.entries()) {
        const metadata = {
          source: 'notatnik-rafala',
          type: 'diary',
          chunkIndex: index,
          totalChunks: chunks.length,
          date: new Date().toISOString()
        };

        await insertDocumentWithEmbedding(chunk, metadata);
        console.log(`Zaindeksowano chunk ${index + 1}/${chunks.length}`);
      }

      console.log('Zakończono indeksowanie pliku');
    } catch (err) {
      console.error('Błąd podczas indeksowania:', err);
      throw err;
    }
  }
} 