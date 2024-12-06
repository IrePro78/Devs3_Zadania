import { OpenAI } from 'openai';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface PhoneCall {
  start: string;
  reszta: string;
  length: number;
}

interface PhoneData {
  [key: string]: PhoneCall;
}

interface ProcessedCall {
  start: string;
  ciąg_dalszy: string[];
  end: string;
  length: number;
}

interface ProcessedData {
  [key: string]: ProcessedCall;
}

export class PhoneProcessor {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  private async processConversation(start: string, reszta: string, length: number): Promise<ProcessedCall> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Jesteś ekspertem od analizy rozmów telefonicznych.
            Twoim zadaniem jest podzielić tekst rozmowy na logiczne części.
            - Zachowaj oryginalny styl i język rozmowy
            - Podziel tekst na 3-5 linijek w ciąg_dalszy
            - Ostatnia linijka powinna być w end
            - Usuń powtórzenia i niespójności
            - Zachowaj ważne informacje i kontekst`
          },
          {
            role: "user",
            content: `Początek rozmowy:\n${start}\n\nReszta rozmowy:\n${reszta}\n\nPodziel tekst na ciąg_dalszy (3-5 linii) i end (ostatnia linia).`
          }
        ],
        temperature: 0.3
      });

      const result = response.choices[0].message.content;
      if (!result) throw new Error('Brak odpowiedzi od modelu');

      // Parsuj odpowiedź
      const lines = result.split('\n').filter(line => line.trim());
      const end = lines.pop() || '';
      const ciąg_dalszy = lines;

      return {
        start,
        ciąg_dalszy,
        end,
        length
      };
    } catch (error) {
      console.error('Błąd podczas przetwarzania rozmowy:', error);
      throw error;
    }
  }

  async processPhoneData(): Promise<void> {
    try {
      // Wczytaj dane
      const phoneDataPath = join(__dirname, '..', 'data', 'phone.json');
      const phoneData: PhoneData = JSON.parse(await readFile(phoneDataPath, 'utf-8'));

      // Przetwórz każdą rozmowę
      const processedData: ProcessedData = {};
      for (const [key, call] of Object.entries(phoneData)) {
        console.log(`Przetwarzanie rozmowy ${key}...`);
        processedData[key] = await this.processConversation(
          call.start,
          call.reszta,
          call.length
        );
      }

      // Zapisz wynik
      const outputPath = join(__dirname, '..', 'data', 'transcripts.json');
      await writeFile(outputPath, JSON.stringify(processedData, null, 2));
      console.log(`Zapisano przetworzone dane do: ${outputPath}`);
    } catch (error) {
      console.error('Błąd podczas przetwarzania danych:', error);
      throw error;
    }
  }
} 