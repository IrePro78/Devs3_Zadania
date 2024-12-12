import { OpenAI } from 'openai';
import * as fs from 'fs/promises';
import { searchSimilarDocuments, searchTranscripts } from '../../supabase/client';

interface StoryQuestion {
  [key: string]: string;
}

export class QuestionsService {
  private openai: OpenAI;
  private readonly CONTEXT_LIMIT = 3;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processQuestions(questionsPath: string, outputPath: string): Promise<void> {
    try {
      // Wczytaj pytania
      const questions = await this.loadQuestions(questionsPath);
      const answers: string[] = [];

      // Przetwórz każde pytanie w kolejności
      const sortedIds = Object.keys(questions).sort();
      for (const id of sortedIds) {
        const question = questions[id];
        console.log(`\nPrzetwarzanie pytania ${id}: ${question}`);
        
        // Łączymy wyniki z obu typów wyszukiwania
        const [vectorResults, textResults] = await Promise.all([
          searchSimilarDocuments(question, this.CONTEXT_LIMIT),
          searchTranscripts(question)
        ]);

        // Łączymy i deduplikujemy wyniki
        const allResults = [...vectorResults, ...textResults];
        const uniqueResults = this.deduplicateResults(allResults);
        const context = uniqueResults.map(doc => doc.content).join('\n\n');

        // Wygeneruj odpowiedź
        const answer = await this.generateAnswer(question, context);
        answers.push(answer);

        console.log(`✓ Zapisano odpowiedź dla pytania ${id}`);
      }

      // Zapisz odpowiedzi do pliku
      await fs.writeFile(outputPath, JSON.stringify(answers, null, 2), 'utf-8');
      console.log(`\n✓ Zapisano wszystkie odpowiedzi do ${outputPath}`);

    } catch (error) {
      console.error('Błąd podczas przetwarzania pytań:', error);
      throw error;
    }
  }

  private async loadQuestions(path: string): Promise<StoryQuestion> {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content);
  }

  private async generateAnswer(question: string, context: string): Promise<string> {
    if (!context.trim()) {
      return "Brak wyniku";
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem w udzielaniu odpowiedzi na pytania wyszukując w treści wyszukiwań z bazy wektorowej. Udzielaj bardzo krótkich, odpowiedzi w kontekście, odpowiedz 'Brak wyniku'."
        },
        {
          role: "user",
          content: `Kontekst:\n${context}\n\nPytanie: ${question}\n\nOdpowiedz jednym zdaniem lub 'Brak wyniku'.`
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    });

    const answer = response.choices[0].message.content?.trim() || 'Brak wyniku';
    return answer === '' ? 'Brak wyniku' : answer;
  }

  private deduplicateResults(results: any[]): any[] {
    const seen = new Set();
    return results.filter(doc => {
      const isDuplicate = seen.has(doc.content);
      seen.add(doc.content);
      return !isDuplicate;
    });
  }
} 