import { OpenAI } from 'openai';
<<<<<<< HEAD
import { searchWithMetadata } from '../../supabase/client';

export class QuestionsService {
  private openai: OpenAI;
=======
import * as fs from 'fs/promises';
import { searchSimilarDocuments, searchTranscripts } from '../../supabase/client';

interface StoryQuestion {
  [key: string]: string;
}

export class QuestionsService {
  private openai: OpenAI;
  private readonly CONTEXT_LIMIT = 3;
>>>>>>> 1d11fc25fab466b081cf89edd1f5555edc1ad2aa

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

<<<<<<< HEAD
  async answerQuestion(question: string): Promise<string> {
    try {
      const results = await searchWithMetadata(
        question,
        0.05,
        5
      );

      if (!results.length) {
        return 'Nie znaleziono odpowiedzi.';
      }

      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);

      const context = sortedResults
        .map(r => `[${(r.similarity * 100).toFixed(1)}%] ${r.content}`)
        .join('\n\n');

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Jesteś precyzyjnym asystentem, który odpowiada na pytania na podstawie dostarczonego kontekstu. Odpowiadaj krótko i konkretnie. Jeśli nie znajdziesz odpowiedzi w kontekście, napisz 'Brak informacji w kontekście.'"
          },
          {
            role: "user",
            content: `Kontekst:\n${context}\n\nPytanie: ${question}\n\nOdpowiedz krótko i precyzyjnie, używając tylko informacji z kontekstu.`
          }
        ],
        temperature: 0.5,
        max_tokens: 100
      });

      return response.choices[0].message.content?.trim() || 'Nie znaleziono odpowiedzi.';
    } catch (error) {
      console.error('Błąd podczas wyszukiwania odpowiedzi:', error);
      throw error;
=======
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
>>>>>>> 1d11fc25fab466b081cf89edd1f5555edc1ad2aa
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