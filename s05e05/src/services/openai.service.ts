import { OpenAI } from 'openai';
import { createReadStream } from 'fs';
import { withRetry } from '../utils/retry';

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async transcribeAudio(filePath: string): Promise<string> {
    return withRetry(async () => {
      const response = await this.openai.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: "whisper-1",
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
              { type: "text", text: "Opisz szczegółowo co widzisz na tym obrazku. Skup się na istotnych elementach i kontekście." },
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

      return response.choices[0].message.content || '';
    }, {
      maxAttempts: 3,
      delay: 2000,
      backoff: 2
    });
  }
} 