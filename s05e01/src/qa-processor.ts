import { OpenAI } from 'openai';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Transcripts } from './types';

export class QAProcessor {
  private openai: OpenAI;
  private transcripts: Transcripts = {};
  private facts: string[] = [];

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async initialize(): Promise<void> {
    // Wczytaj transkrypcje
    const transcriptsPath = join(__dirname, '..', 'data', 'transcripts.json');
    const transcriptsData = await readFile(transcriptsPath, 'utf-8');
    this.transcripts = JSON.parse(transcriptsData);

    // Wczytaj fakty z plików txt
    const factsDir = join(__dirname, '..', 'facts');
    const factFiles = await readdir(factsDir);
    
    for (const file of factFiles) {
      if (file.endsWith('.txt')) {
        const content = await readFile(join(factsDir, file), 'utf-8');
        this.facts.push(content);
      }
    }
  }

  private splitIntoChunks(text: string, maxLength: number = 1000): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxLength) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  private async findAnswerInTranscripts(question: string): Promise<string | null> {
    // Przygotuj pełny tekst rozmów
    const context = Object.entries(this.transcripts)
      .map(([key, conversation]) => {
        const lines = [
          conversation.start,
          ...(conversation.ciąg_dalszy || []),
          conversation.end
        ];
        return `${key}:\n${lines.join('\n')}`;
      })
      .join('\n\n');

    const chunks = this.splitIntoChunks(context);
    
    for (const chunk of chunks) {
      try {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Jesteś asystentem analizującym transkrypcje rozmów telefonicznych.
              - Odpowiadaj maksymalnie zwięźle, najlepiej 1-2 słowa
              - Bazuj tylko na informacjach z transkrypcji
              - Jeśli nie ma jednoznacznej odpowiedzi, odpowiedz "null"
              - Jeśli odpowiedzią ma być odpowiedź z endpointu to wyślij zapytanie do tego url i zwrócony wynik zwróć jako odpowiedź
              - Nie dodawaj żadnych wyjaśnień ani kontekstu`
            },
            {
              role: "user",
              content: `Kontekst (transkrypcje rozmów):\n${chunk}\n\nPytanie: ${question}\n\nOdpowiedź:`
            }
          ],
          temperature: 0.1
        });

        const answer = response.choices[0].message.content?.trim();
        if (answer && answer !== 'null') return answer;
      } catch (error) {
        console.error('Błąd podczas przetwarzania transkrypcji:', error);
      }
    }
    return null;
  }

  private async findAnswerInFacts(question: string): Promise<string | null> {
    if (this.facts.length === 0) return null;
    
    const context = this.facts.join('\n\n');
    const chunks = this.splitIntoChunks(context);

    for (const chunk of chunks) {
      try {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Jesteś asystentem analizującym dodatkowe fakty.
              - Odpowiadaj maksymalnie zwięźle, najlepiej 1-2 słowa
              - Bazuj tylko na dostarczonych faktach
              - Jeśli nie ma jednoznacznej odpowiedzi, odpowiedz "null"
              - Nie dodawaj żadnych wyjaśnień ani kontekstu`
            },
            {
              role: "user",
              content: `Kontekst (fakty):\n${chunk}\n\nPytanie: ${question}\n\nOdpowiedź:`
            }
          ],
          temperature: 0.1
        });

        const answer = response.choices[0].message.content?.trim();
        if (answer && answer !== 'null') return answer;
      } catch (error) {
        console.error('Błąd podczas przetwarzania faktów:', error);
      }
    }
    return null;
  }

  async processQuestions(questionsPath: string): Promise<Record<string, string>> {
    const questionsData = await readFile(questionsPath, 'utf-8');
    const questions: Record<string, string> = JSON.parse(questionsData);
    const answers: Record<string, string> = {};

    for (const [id, question] of Object.entries(questions)) {
      console.log(`Przetwarzanie pytania ${id}: ${question}`);
      
      // Najpierw szukaj w transkrypcjach
      let answer = await this.findAnswerInTranscripts(question);
      
      // Jeśli nie znaleziono, szukaj w faktach
      if (!answer) {
        answer = await this.findAnswerInFacts(question);
      }

      answers[id] = answer || 'brak odpowiedzi';
    }

    return answers;
  }
} 