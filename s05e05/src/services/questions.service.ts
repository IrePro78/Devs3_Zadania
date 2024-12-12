import { OpenAI } from 'openai';
import { searchWithMetadata } from '../../supabase/client';

export class QuestionsService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

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
    }
  }
} 