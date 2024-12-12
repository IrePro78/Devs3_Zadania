import { OpenAI } from 'openai';
import { createReadStream } from 'fs';
import { withRetry } from '../utils/retry';
import { AI_CONFIG } from '../config/ai.config';
import * as fs from 'fs/promises';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';

const CHUNK_SIZE_MB = 8; // Bezpieczny rozmiar chunka

export class OpenAIService {
  private openai: OpenAI;
  private groqAI: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Inicjalizacja klienta Groq z tym samym interfejsem co OpenAI
    this.groqAI = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }

  async transcribeAudio(filePath: string): Promise<string> {
    return withRetry(async () => {
      const response = await this.groqAI.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: "whisper-large-v3-turbo",
        language: "pl"
      });
      return response.text;
    }, {
      maxAttempts: 3,
      delay: 2000,
      backoff: 2
    });
  }

  async describeImage(buffer: Buffer): Promise<string> {
    return withRetry(async () => {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: "Wydobądź i zwróć tylko tekst widoczny na tym obrazie. Nie opisuj jak obraz wygląda. Jeśli to skan dokumentu lub zdjęcie tekstu, podaj jego treść. Jeśli nie ma tekstu, napisz 'Brak tekstu'." 
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${buffer.toString('base64')}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      return response.choices[0].message.content || 'Nie udało się odczytać tekstu';
    }, {
      maxAttempts: 3,
      delay: 2000,
      backoff: 2
    });
  }
} 