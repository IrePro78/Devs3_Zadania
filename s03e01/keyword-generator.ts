import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface KeywordResult {
  [filename: string]: string;
}

interface FactAnalysis {
  filename: string;
  subjects: string[];
  keywords: string[];
}

interface ReportAnalysis {
  filename: string;
  subjects: string[];
  content: string;
}

class KeywordGenerator {
  private openai: OpenAI;
  private readonly FACTORY_FILES_DIR = 'pliki_z_fabryki';
  private readonly FACTS_DIR = 'pliki_z_fabryki/facts';
  private factsAnalysis: FactAnalysis[] = [];
  private reportsAnalysis: ReportAnalysis[] = [];

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Brak klucza API OpenAI w zmiennych środowiskowych!');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async generateKeywords(): Promise<KeywordResult> {
    try {
      // 1. Analiza faktów
      console.log('Analizuję pliki z faktami...');
      await this.analyzeFacts();
      
      // 2. Analiza raportów
      console.log('\nAnalizuję raporty...');
      await this.analyzeReports();
      
      // 3. Generowanie słów kluczowych
      console.log('\nGeneruję słowa kluczowe...');
      const keywords: KeywordResult = {};

      for (const report of this.reportsAnalysis) {
        console.log(`\nPrzetwarzam raport: ${report.filename}`);
        
        // Znajdź powiązane fakty
        const relatedFacts = this.factsAnalysis.filter(fact => 
          fact.subjects.some(subject => 
            report.subjects.includes(subject)
          )
        );

        if (relatedFacts.length > 0) {
          console.log(`Znaleziono ${relatedFacts.length} powiązanych faktów`);
          
          const response = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "Wygeneruj słowa kluczowe w formie mianownika na podstawie powiązanych faktów i raportu."
              },
              {
                role: "user",
                content: `RAPORT:
${report.content}

POWIĄZANE FAKTY:
${relatedFacts.map(fact => `[${fact.filename}]: ${fact.keywords.join(', ')}`).join('\n')}

Wygeneruj słowa kluczowe według następujących zasad:
1. Użyj słów w formie mianownika
2. Uwzględnij:
   - osoby (imiona, nazwiska, funkcje)
   - miejsca
   - zdarzenia
   - przedmioty
   - daty
   - procedury
3. Wykorzystaj kontekst z powiązanych faktów
4. Zachowaj spójną terminologię

Zwróć tylko słowa kluczowe oddzielone przecinkami.`
              }
            ],
            temperature: 0.1,
            max_tokens: 150
          });

          keywords[report.filename] = response.choices[0]?.message?.content?.trim() || 'brak słów kluczowych';
        } else {
          console.log('Brak powiązanych faktów, generuję słowa kluczowe tylko z raportu');
          
          const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "Wygeneruj słowa kluczowe w formie mianownika na podstawie treści raportu."
              },
              {
                role: "user",
                content: `RAPORT:
${report.content}

Wygeneruj słowa kluczowe według następujących zasad:
1. Użyj słów w formie mianownika
2. Uwzględnij:
   - osoby (imiona, nazwiska, funkcje)
   - miejsca
   - zdarzenia
   - przedmioty
   - daty
   - procedury

Zwróć tylko słowa kluczowe oddzielone przecinkami.`
              }
            ],
            temperature: 0.1,
            max_tokens: 150
          });

          keywords[report.filename] = response.choices[0]?.message?.content?.trim() || 'brak słów kluczowych';
        }
        
        console.log(`Wygenerowane słowa kluczowe: ${keywords[report.filename]}`);
      }

      // 4. Zapisz wyniki
      await fs.writeFile(
        'keywords.json',
        JSON.stringify(keywords, null, 2)
      );
      console.log('\nWyniki zapisane w keywords.json');

      return keywords;

    } catch (error) {
      console.error('Wystąpił błąd:', error);
      throw error;
    }
  }

  private async analyzeFacts(): Promise<void> {
    const factsFiles = await fs.readdir(this.FACTS_DIR);
    
    for (const file of factsFiles) {
      if (file.endsWith('.txt')) {
        console.log(`\nAnalizuję fact: ${file}`);
        const content = await fs.readFile(
          path.join(this.FACTS_DIR, file),
          'utf-8'
        );

        try {
          const response = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "Przeanalizuj fact i zwróć dokładnie sformatowany obiekt JSON zawierający podmioty i słowa kluczowe."
              },
              {
                role: "user",
                content: `Przeanalizuj poniższy fact i zwróć wynik w formacie JSON:

${content}

Przeanalizuj tekst i wyodrębnij:
1. Listę podmiotów (kogo/czego dotyczy fact)
2. Listę słów kluczowych w mianowniku

WAŻNE: Zwróć tylko poprawny obiekt JSON w formacie:
{"subjects":["podmiot1","podmiot2"],"keywords":["słowo1","słowo2"]}`
              }
            ],
            temperature: 0.1,
            max_tokens: 500
          });

          const responseText = response.choices[0]?.message?.content?.trim() || '{"subjects":[],"keywords":[]}';
          
          // Dodajemy dodatkowe zabezpieczenie przed niepoprawnym JSON
          let analysis;
          try {
            analysis = JSON.parse(responseText);
          } catch (parseError) {
            console.error(`Błąd parsowania JSON dla pliku ${file}:`, responseText);
            analysis = { subjects: [], keywords: [] };
          }

          this.factsAnalysis.push({
            filename: file,
            subjects: analysis.subjects || [],
            keywords: analysis.keywords || []
          });

          console.log(`Przeanalizowano fact ${file}:`, analysis);
        } catch (error) {
          console.error(`Błąd podczas analizy pliku ${file}:`, error);
          this.factsAnalysis.push({
            filename: file,
            subjects: [],
            keywords: []
          });
        }
      }
    }
  }

  private async analyzeReports(): Promise<void> {
    const files = await fs.readdir(this.FACTORY_FILES_DIR);
    const reportFiles = files.filter(file => 
      file.endsWith('.txt') && 
      !path.relative(this.FACTORY_FILES_DIR, file).startsWith('facts/')
    );

    for (const file of reportFiles) {
      console.log(`\nAnalizuję raport: ${file}`);
      try {
        const content = await fs.readFile(
          path.join(this.FACTORY_FILES_DIR, file),
          'utf-8'
        );

        const response = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "Przeanalizuj raport i zwróć dokładnie sformatowany obiekt JSON zawierający listę podmiotów."
            },
            {
              role: "user",
              content: `Przeanalizuj poniższy raport i wyodrębnij listę podmiotów (kogo/czego dotyczy):

${content}

WAŻNE: Zwróć tylko poprawny obiekt JSON w dokładnie takim formacie:
{"subjects":["podmiot1","podmiot2"]}`
            }
          ],
          temperature: 0.1,
          max_tokens: 150
        });

        const responseText = response.choices[0]?.message?.content?.trim() || '{"subjects":[]}';
        
        let analysis;
        try {
          analysis = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`Błąd parsowania JSON dla raportu ${file}:`, responseText);
          analysis = { subjects: [] };
        }

        this.reportsAnalysis.push({
          filename: file,
          subjects: analysis.subjects || [],
          content: content
        });

        console.log(`Przeanalizowano raport ${file}:`, analysis);
      } catch (error) {
        console.error(`Błąd podczas analizy raportu ${file}:`, error);
        this.reportsAnalysis.push({
          filename: file,
          subjects: [],
          content: ''
        });
      }
    }
  }
}

// Użycie
async function main() {
  const generator = new KeywordGenerator();
  try {
    await generator.generateKeywords();
  } catch (error) {
    console.error('Błąd główny:', error);
  }
}

main(); 