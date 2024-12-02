import { readFile, writeFile } from 'fs/promises';
import TurndownService from 'turndown';

interface ConversionOptions {
  readonly inputPath: string;
  readonly outputPath: string;
}

/**
 * Konwertuje plik HTML na format Markdown z zachowaniem formatowania
 */
export class HtmlToMarkdownConverter {
  private readonly turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      hr: '---'
    });

    this.configureTurndownRules();
  }

  private configureTurndownRules(): void {
    // Zachowaj obrazy z pełnymi ścieżkami
    this.turndownService.addRule('images', {
      filter: 'img',
      replacement: (content, node: any) => {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        return `\n\n![${alt}](${src})\n\n`;
      }
    });

    // Lepsze formatowanie nagłówków
    this.turndownService.addRule('headers', {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      replacement: (content, node: any) => {
        const level = Number(node.nodeName.charAt(1));
        const prefix = '#'.repeat(level);
        return `\n\n${prefix} ${content}\n\n`;
      }
    });

    // Lepsze formatowanie paragrafów
    this.turndownService.addRule('paragraphs', {
      filter: 'p',
      replacement: content => `\n\n${content}\n\n`
    });

    // Usuń niepotrzebne style
    this.turndownService.addRule('removeStyles', {
      filter: ['style', 'script'],
      replacement: () => ''
    });
  }

  private cleanMarkdown(markdown: string): string {
    return markdown
      // Usuń style CSS
      .replace(/\.s\d+\s*{[^}]+}/g, '')
      .replace(/\.p,\s*p\s*{[^}]+}/g, '')
      // Usuń puste linie z początku i końca sekcji
      .replace(/\n{3,}/g, '\n\n')
      // Usuń spacje na końcach linii
      .replace(/\s+$/gm, '')
      // Dodaj separator między sekcjami
      .replace(/(\n\n#{1,6}\s)/g, '\n\n---\n\n$1')
      // Usuń podwójne separatory
      .replace(/---\n\n---/g, '---')
      // Usuń puste linie na początku i końcu dokumentu
      .trim();
  }

  /**
   * Wykonuje konwersję pliku HTML na Markdown
   */
  public async convertFile(options: ConversionOptions): Promise<void> {
    try {
      const htmlContent = await readFile(options.inputPath, 'utf-8');
      let markdownContent = this.turndownService.turndown(htmlContent);
      markdownContent = this.cleanMarkdown(markdownContent);
      await writeFile(options.outputPath, markdownContent, 'utf-8');
    } catch (err) {
      throw new Error(`Błąd podczas konwersji pliku: ${(err as Error).message}`);
    }
  }
} 