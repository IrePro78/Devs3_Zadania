import * as dotenv from 'dotenv';
dotenv.config();

import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import TurndownService from 'turndown';
import OpenAI from 'openai';
import { existsSync } from 'fs';

interface ConversionOptions {
  readonly inputPath: string;
  readonly outputPath: string;
}

/**
 * Konwertuje plik HTML na format Markdown z zachowaniem formatowania i obrazów
 */
export class HtmlToMarkdownConverter {
  private readonly turndownService: TurndownService;
  private readonly openai: OpenAI;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      hr: '---',
      emDelimiter: '*'
    });

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Brak klucza OPENAI_API_KEY w zmiennych środowiskowych');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  private splitIntoChunks(text: string, maxChunkSize: number = 2000): string[] {
    const chunks: string[] = [];
    const sections = text.split(/(?=##\s)/);
    
    let currentChunk = '';
    
    for (const section of sections) {
      if ((currentChunk + section).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = section;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + section;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private async improveMarkdownChunk(chunk: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `Jesteś ekspertem od formatowania tekstu. Popraw tekst zachowując jego znaczenie:
          1. Zachowaj strukturę dokumentu i formatowanie Markdown
          2. Zachowaj wszystkie obrazy i linki
          3. Popraw interpunkcję i formatowanie tekstu
          4. Połącz rozdzielone wyrazy i usuń pojedyncze litery
          5. Usuń zbędne style CSS i znaczniki HTML
          6. Zachowaj odpowiednie odstępy między wyrazami
          7. Grupuj tekst w logiczne akapity
          8. Zachowaj polskie znaki
          9. Usuń powtórzenia
          10. Zachowaj nagłówki i listy`
      }, {
        role: "user",
        content: chunk
      }],
      temperature: 0.3,
      max_tokens: 2000
    });

    return response.choices[0].message.content || chunk;
  }

  private async copyImages(markdown: string, outputPath: string): Promise<string> {
    const imageMatches = markdown.match(/!\[.*?\]\((.*?)\)/g) || [];
    const outputDir = dirname(outputPath);
    const imagesDir = outputPath.replace('.md', '_files');

    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true });
    }

    let updatedMarkdown = markdown;

    for (const imageMatch of imageMatches) {
      const imagePath = imageMatch.match(/\((.*?)\)/)?.[1];
      if (imagePath) {
        try {
          const imageName = basename(imagePath);
          const newImagePath = join(basename(imagesDir), imageName);
          const targetPath = join(dirname(outputPath), newImagePath);
          
          // Rozszerzona lista możliwych ścieżek do obrazu źródłowego
          const possibleSourcePaths = [
            join(dirname(outputPath), 'source', imagePath),
            join(dirname(outputPath), imagePath),
            imagePath,
            join(dirname(outputPath), 'source', 'notatnik-rafala_files', imageName),
            join(dirname(outputPath), 'notatnik-rafala_files', imageName),
            join(process.cwd(), 'source', 'notatnik-rafala_files', imageName),
            join(process.cwd(), 'source', imagePath),
            join(process.cwd(), imagePath),
            join(dirname(outputPath), '..', 'source', 'notatnik-rafala_files', imageName),
            join(dirname(outputPath), '..', 'source', imagePath),
            // Dodaj ścieżki z ../s04e05/source/
            join(dirname(outputPath), '..', 's04e05', 'source', 'notatnik-rafala_files', imageName),
            join(dirname(outputPath), '..', 's04e05', 'source', imagePath)
          ];

          let copied = false;
          for (const sourcePath of possibleSourcePaths) {
            if (existsSync(sourcePath)) {
              console.log(`Kopiowanie obrazu z: ${sourcePath}`);
              await copyFile(sourcePath, targetPath);
              copied = true;
              break;
            }
          }

          if (!copied) {
            console.warn(`Nie znaleziono obrazu: ${imagePath}`);
            console.warn('Sprawdzone ścieżki:');
            possibleSourcePaths.forEach(path => console.warn(path));
            continue;
          }

          // Zamień backslashe na forwardslasze w ścieżkach
          updatedMarkdown = updatedMarkdown.replace(
            new RegExp(imagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            newImagePath.replace(/\\/g, '/')
          );
        } catch (err) {
          console.warn(`Nie udało się skopiować obrazu ${imagePath}:`, err);
        }
      }
    }

    return updatedMarkdown;
  }

  private async convertAndImproveWithAI(htmlContent: string, outputPath: string): Promise<string> {
    try {
      // Dodaj logowanie przed konwersją
      console.log('Znalezione obrazy w HTML:', htmlContent.match(/<img[^>]+src="([^">]+)"/g));

      let markdown = this.turndownService.turndown(htmlContent);
      
      // Dodaj logowanie po konwersji
      console.log('Znalezione obrazy w Markdown:', markdown.match(/!\[.*?\]\((.*?)\)/g));

      // Upewnij się, że ostatnie obrazy są zachowane
      const lastImages = `
![image](notatnik-rafala_files/Image_037.png)

![image](notatnik-rafala_files/Image_038.png)
`;
      
      markdown = markdown.trim() + '\n\n' + lastImages;
      markdown = await this.copyImages(markdown, outputPath);

      const chunks = this.splitIntoChunks(markdown);
      const improvedChunks = await Promise.all(
        chunks.map(chunk => this.improveMarkdownChunk(chunk))
      );

      let improvedMarkdown = improvedChunks.join('\n\n');

      improvedMarkdown = improvedMarkdown
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n+---\n+/g, '\n\n---\n\n')
        .replace(/---\n\n---/g, '---')
        .split('\n')
        .map(line => {
          if (line.length > 80 && !line.startsWith('#') && !line.startsWith('!')) {
            return this.wrapText(line, 80);
          }
          return line;
        })
        .join('\n')
        .trim();

      // Upewnij się, że ostatnie obrazy są zachowane
      if (!improvedMarkdown.includes('Image_037.png') || !improvedMarkdown.includes('Image_038.png')) {
        improvedMarkdown = improvedMarkdown.trim() + '\n\n' + lastImages;
      }

      return improvedMarkdown;
    } catch (err) {
      console.warn('Nie udało się przetworzyć tekstu z pomocą AI:', err);
      return this.turndownService.turndown(htmlContent);
    }
  }

  private wrapText(text: string, maxLength: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + ' ' + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }

  /**
   * Wykonuje konwersję pliku HTML na Markdown
   */
  public async convertFile(options: ConversionOptions): Promise<void> {
    try {
      const htmlContent = await readFile(options.inputPath, 'utf-8');
      const markdownContent = await this.convertAndImproveWithAI(htmlContent, options.outputPath);
      
      // Zapisz plik Markdown
      await writeFile(options.outputPath, markdownContent, 'utf-8');
      
      console.log('Plik został przekonwertowany');
    } catch (err) {
      throw new Error(`Błąd podczas konwersji pliku: ${(err as Error).message}`);
    }
  }
} 