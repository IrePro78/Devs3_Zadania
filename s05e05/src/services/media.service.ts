import { OpenAI } from 'openai';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class MediaService {
  private openai: OpenAI;
  private tempDir: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  async transcribeAudio(buffer: Buffer, format: string): Promise<string> {
    // Konwertuj do WAV jeśli potrzeba
    const wavFile = await this.convertToWav(buffer, format);
    
    const response = await this.openai.audio.transcriptions.create({
      file: createReadStream(wavFile),
      model: "whisper-1",
      language: "pl"
    });

    await fs.unlink(wavFile);
    return response.text;
  }

  async analyzeImage(buffer: Buffer): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Opisz co widzisz na tym obrazku. Skup się na istotnych szczegółach." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${buffer.toString('base64')}`
              }
            }
          ]
        }
      ]
    });

    return response.choices[0].message.content || 'Nie udało się opisać obrazu';
  }

  private async convertToWav(buffer: Buffer, format: string): Promise<string> {
    await fs.mkdir(this.tempDir, { recursive: true });
    
    const inputFile = path.join(this.tempDir, `input.${format}`);
    const outputFile = path.join(this.tempDir, 'output.wav');
    
    await fs.writeFile(inputFile, buffer);

    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .toFormat('wav')
        .on('end', () => {
          fs.unlink(inputFile)
            .then(() => resolve(outputFile))
            .catch(reject);
        })
        .on('error', reject)
        .save(outputFile);
    });
  }

  async getImageMetadata(buffer: Buffer): Promise<{ width: number; height: number }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    };
  }
} 