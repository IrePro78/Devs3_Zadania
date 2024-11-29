import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { Answer } from '../types/question.type';
import { CONFIG } from '../config/config';
import OpenAI from 'openai';

interface PageData {
  content: string;
  links: string[];
}

export class WebCrawler {
  private visitedUrls: Map<string, PageData> = new Map();
  private readonly MAX_DEPTH = 3;
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    if (!existsSync('visited_pages')) {
      mkdirSync('visited_pages');
    }
  }

  public async findAnswers(questions: string[]): Promise<Map<string, Answer>> {
    const answers = new Map<string, Answer>();
    console.log('\n🔍 Rozpoczynam szukanie odpowiedzi na pytania:', questions);

    // Zacznij od głównej strony
    await this.processPage(CONFIG.BASE_URL, questions, answers, 0);

    return answers;
  }

  private async processPage(url: string, questions: string[], answers: Map<string, Answer>, depth: number): Promise<void> {
    const normalizedUrl = this.normalizeUrl(url);
    
    console.log(`🔍 Próba przetworzenia strony: ${normalizedUrl} (głębokość: ${depth})`);
    
    if (depth > this.MAX_DEPTH) {
      console.log(`🛑 Przekroczono maksymalną głębokość (${this.MAX_DEPTH}) dla: ${normalizedUrl}`);
      return;
    }

    let pageData: PageData;

    if (this.visitedUrls.has(normalizedUrl)) {
      console.log(`📑 Używam zapisanej treści dla: ${normalizedUrl}`);
      pageData = this.visitedUrls.get(normalizedUrl)!;
    } else {
      console.log(`\n📄 Pobieram nową stronę (głębokość ${depth}): ${normalizedUrl}`);
      
      try {
        const response = await fetch(normalizedUrl);
        const html = await response.text();
        const cleanContent = this.cleanHtml(html);
        const links = this.getLinks(html, normalizedUrl);

        pageData = {
          content: cleanContent,
          links: links
        };

        // Zapisz oryginalną i oczyszczoną treść strony
        const pageNumber = this.visitedUrls.size + 1;
        
        // Zapisz oryginalny HTML
        writeFileSync(
          join('visited_pages', `page_${pageNumber}_raw.html`),
          `<!-- URL: ${normalizedUrl} -->\n${html}`
        );

        // Zapisz oczyszczoną wersję
        writeFileSync(
          join('visited_pages', `page_${pageNumber}_clean.txt`),
          `URL: ${normalizedUrl}\n\nZnalezione linki:\n${links.join('\n')}\n\nTreść oczyszczona:\n${cleanContent}`
        );

        this.visitedUrls.set(normalizedUrl, pageData);
        console.log(`📊 Zapisano stronę numer ${pageNumber} (raw i clean)`);
      } catch (error) {
        console.error(`❌ Błąd podczas pobierania strony ${normalizedUrl}:`, error);
        return;
      }
    }

    // Sprawdź odpowiedzi w treści strony
    const remainingQuestions = questions.filter(q => !answers.has(q));
    console.log(`❓ Pozostało pytań do odpowiedzi: ${remainingQuestions.length}`);
    
    for (const question of remainingQuestions) {
      const answer = await this.checkForAnswer(question, pageData.content);
      if (answer) {
        console.log(`✅ Znaleziono odpowiedź na pytanie: "${question}"\nOdpowiedź: ${answer}`);
        answers.set(question, {
          question,
          answer,
          sourceUrl: normalizedUrl
        });
      }
    }

    // Jeśli nie znaleziono wszystkich odpowiedzi, sprawdź linki
    if (answers.size < questions.length) {
      const unvisitedLinks = pageData.links.filter(link => 
        !this.visitedUrls.has(this.normalizeUrl(link))
      );
      
      console.log(`\n🔗 Nieodwiedzone linki (${unvisitedLinks.length}/${pageData.links.length}):`);
      unvisitedLinks.forEach(link => console.log(`  → ${link}`));

      for (const link of unvisitedLinks) {
        if (answers.size === questions.length) {
          console.log('✨ Znaleziono wszystkie odpowiedzi, kończę przeszukiwanie.');
          return;
        }
        await this.processPage(link, questions, answers, depth + 1);
      }
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Usuń trailing slash, parametry i fragment
      return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
    } catch {
      return url;
    }
  }

  private async checkForAnswer(question: string, content: string): Promise<string | null> {
    try {
      console.log('\n🔍 Analizuję treść dla pytania:', question);

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Jesteś precyzyjnym asystentem szukającym odpowiedzi na pytanie.
                     Szukaj odpowiedzi na pytanie w treści strony lub adresów URL znalezionych w treści strony.
                     
                     Zwracaj szczególną uwagę na:
                     - adresy URL i interfejsy webowe
                     - nazwy firm i produktów
                     - konkretne implementacje i wdrożenia
                     - opisy projektów i realizacji
                    
                     Nie zwracaj pytania ani żadnych innych informacji.
                     Odpowiedz TYLKO jeśli znajdziesz dokładną informację.
                     Jeśli nie ma dokładnej odpowiedzi, odpowiedz "null".`
          },
          {
            role: "user",
            content: `Pytanie: ${question}\n\nTreść strony: ${content}`
          }
        ],
        temperature: 0.1
      });

      const answer = completion.choices[0].message.content || 'null';
      if (answer === 'null') {
        console.log('❌ Nie znaleziono odpowiedzi w tej treści');
        return null;
      }

      console.log('✅ Znaleziono odpowiedź:', answer);
      return answer;
    } catch (error) {
      console.error('❌ Błąd podczas analizy:', error);
      return null;
    }
  }

  private getLinks(html: string, baseUrl: string): string[] {
    const links = new Set<string>();
    const regex = /<a[^>]*(?:href=["']([^"']+)["'])[^>]*(?:title=["']([^"']+)["'])?[^>]*>([^<]*)<\/a>/gi;
    
    let match;

    const ignoredPaths = [
     
      '/whatever',
      'whatever',
      '/loop',
      'loop',
      '/czescizamienne',
      'czescizamienne',
      '/cennik',
      'cennik'
    ];

    while ((match = regex.exec(html)) !== null) {
      try {
        const [fullMatch, href, title, linkText] = match;
        if (!href) continue;

        // Sprawdź czy link ma atrybut hidden
        if (fullMatch.toLowerCase().includes('hidden')) {
          console.log(`  ❌ Pominięto ukryty link: ${href}`);
          continue;
        }

        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = new URL(href, baseUrl).toString();
        }

        const normalizedUrl = this.normalizeUrl(fullUrl);
        
        // Sprawdź czy link nie zawiera ignorowanych ścieżek
        const shouldIgnore = ignoredPaths.some(path => 
          normalizedUrl.includes(path)
        );

        if (shouldIgnore) {
          console.log(`  ❌ Pominięto ignorowaną ścieżkę: ${normalizedUrl}`);
          continue;
        }

        // Sprawdź czy URL jest z tej samej domeny i nie jest zasobem
        if (normalizedUrl.includes('.ag3nts.org') && 
            !this.visitedUrls.has(normalizedUrl) &&
            !/\.(css|js|jpg|jpeg|png|gif|ico)$/.test(normalizedUrl)) {
          
          // Zapisz informacje o linku
          console.log(`  🔍 Znaleziono link:
            URL: ${normalizedUrl}
            Title: ${title || 'brak'}
            Text: ${linkText.trim() || 'brak'}`);

          links.add(normalizedUrl);
          console.log(links);
        }
      } catch (error) {
        console.log('  ⚠️ Błąd przetwarzania linku:', error);
      }
    }

    const uniqueLinks = Array.from(links);
    console.log(`\n📊 Znalezione unikalne linki: ${uniqueLinks.length}`);
    return uniqueLinks;
  }

  private cleanHtml(html: string): string {
    let cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Zamień tagi <a> na tekst z URLem bez nawiasów
    cleanedHtml = cleanedHtml.replace(
      /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi,
      (match, href, text) => `${text} ${href}`
    );

    // Usuń pozostałe tagi HTML
    cleanedHtml = cleanedHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanedHtml;
  }

  private savePage(url: string, content: string, links: string[]): void {
    const pageNumber = this.visitedUrls.size + 1;
    const pageInfo = `URL: ${url}\n\n` +
                    `Znalezione linki:\n${links.map(link => `- ${link}`).join('\n')}\n\n` +
                    `Treść strony:\n${content}`;
    
    writeFileSync(
      join('visited_pages', `page_${pageNumber}_clean.txt`),
      pageInfo
    );
    console.log(`📝 Zapisano stronę ${pageNumber} do pliku`);
  }
} 