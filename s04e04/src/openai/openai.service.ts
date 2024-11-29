import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  public async getShortAnswer(question: string): Promise<string> {
    console.log('Otrzymano pytanie:', question);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Jestem strażnikiem mapy podzielonej na 16 sektorów (4x4). Mapa przedstawia następujący teren:

[START][ŁĄKA][DRZEWO][DOM]
[ŁĄKA][WIATRAK][ŁĄKA][ŁĄKA]
[ŁĄKA][ŁĄKA][SKAŁY][DRZEWA]
[SKAŁY][SKAŁY][SAMOCHÓD][JASKINIA]

Pilot startuje zawsze z sektora [1,1] oznaczonego jako START.
Każdy ruch pilota to przejście o jeden sektor (pole).

Gdy podasz mi współrzędne sektora w formacie [wiersz,kolumna], odpowiem co znajduje się w tym miejscu. Na przykład:
- Dla sektora [1,1] odpowiem: "START" (punkt startowy pilota)
- Dla sektora [2,2] odpowiem: "WIATRAK"
- Dla sektora [4,4] odpowiem: "JASKINIA"
Zanim odpowiem, zastanów się, czy współrzędne są poprawne.

Odpowiem tylko nazwą terenu, który znajduje się we wskazanym sektorze.`
          },
          {
            role: 'user',
            content: question,
          },
        ],
        max_tokens: 10,
        temperature: 0.7,
      });

      const answer = completion.choices[0]?.message.content?.trim() ?? '';
      console.log(`Odpowiedź: "${answer}"`);
      
      return answer;
    } catch (error) {
      console.error('Błąd:', error);
      throw error;
    }
  }
} 