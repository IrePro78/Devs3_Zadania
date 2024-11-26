import OpenAI from 'openai';
import * as fs from 'fs/promises';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface Answer {
  [key: string]: string;
}

class QuestionAnswerer {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Brak klucza API OpenAI w zmiennych środowiskowych!');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async getQuestions(url: string): Promise<[string, string][]> {
    try {
      console.log('Pobieram pytania z:', url);
      const response = await axios.get(url);
      const questions = response.data
        .split('\n')
        .filter((line: string) => line.trim().endsWith('?'))
        .map((line: string) => {
          const [id, ...questionParts] = line.replace('=', ' ').split(' ');
          return [id, questionParts.join(' ')];
        });
      
      console.log(`Znaleziono ${questions.length} pytań`);
      return questions;
    } catch (error) {
      console.error('Błąd podczas pobierania pytań:', error);
      throw error;
    }
  }

  async getContext(): Promise<string> {
    try {
      console.log('Wczytuję kontekst z arxiv-draft.md');
      return await fs.readFile('arxiv-draft.md', 'utf-8');
    } catch (error) {
      console.error('Błąd podczas wczytywania kontekstu:', error);
      throw error;
    }
  }

  async answerQuestions(): Promise<Answer> {
    try {
      const questions = await this.getQuestions('https://centrala.ag3nts.org/data/9ce91d39-cedd-40fa-add8-cfa5db47b5ab/arxiv.txt');
      const context = await this.getContext();

      const answers: Answer = {};

      // Odpowiedz na każde pytanie
      for (const [questionId, questionText] of questions) {
        console.log(`\nPrzetwarzam ${questionId}: ${questionText}`);

        try {
          const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "Jesteś ekspertem w analizie tekstu. Odpowiadaj JEDNYM krótkim zdaniem na podstawie dostarczonego kontekstu. Jeśli nie możesz znaleźć odpowiedzi w kontekście, skup się i spróbuj raz jeszcze .'"
              },
              {
                role: "user",
                content: `Kontekst:\n${context}\n\nPytanie: ${questionText}\n\nOdpowiedz jednym krótkim zdaniem.`
              }
            ],
            temperature: 0.3,
            max_tokens: 100
          });

          const answer = response.choices[0]?.message?.content?.trim() || 'Brak odpowiedzi.';
          console.log(`Odpowiedź: ${answer}`);
          answers[questionId] = answer;

        } catch (error) {
          console.error(`Błąd podczas generowania odpowiedzi na pytanie ${questionId}:`, error);
          answers[questionId] = 'Wystąpił błąd podczas generowania odpowiedzi.';
        }
      }

      // Zapisz wyniki do pliku JSON
      console.log('\nZapisuję odpowiedzi do pliku...');
      await fs.writeFile(
        'answers.json',
        JSON.stringify(answers, null, 2)
      );
      console.log('Odpowiedzi zostały zapisane do pliku answers.json');

      return answers;

    } catch (error) {
      console.error('Wystąpił błąd podczas przetwarzania pytań:', error);
      throw error;
    }
  }
}

// Użycie
async function main() {
  const answerer = new QuestionAnswerer();
  try {
    await answerer.answerQuestions();
  } catch (error) {
    console.error('Błąd główny:', error);
  }
}

main(); 