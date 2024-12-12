import { OpenAI } from 'openai';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import { OpenAIService } from './openai.service';
import { withRetry } from '../utils/retry';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const CHUNK_SIZE_MB = 8; // Bezpieczny rozmiar chunka

export class MediaService {
  private openai: OpenAI;
  private tempDir: string;
  private openaiService: OpenAIService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.tempDir = path.join(process.cwd(), 'temp');
    this.openaiService = new OpenAIService();
  }

  async transcribeAudio(buffer: Buffer, extension: string): Promise<string> {
    try {
      // Zapisz bufor do pliku tymczasowego
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const inputFile = path.join(tempDir, `input.${extension}`);
      await fs.writeFile(inputFile, buffer);

      // Sprawdź rozmiar pliku
      const stats = await fs.stat(inputFile);
      const fileSizeMB = stats.size / (1024 * 1024);

      let transcription: string;
      if (fileSizeMB <= CHUNK_SIZE_MB) {
        // Dla małych plików używaj standardowej metody
        transcription = await this.openaiService.transcribeAudio(inputFile);
      } else {
        // Dla dużych plików, podziel i przetranscryptuj części
        console.log(`Dzielę duży plik audio (${fileSizeMB.toFixed(2)}MB) na części...`);
        const chunks = await this.splitAudioFile(inputFile, tempDir);
        
        // Przetranscryptuj każdą część
        const transcriptions = await Promise.all(
          chunks.map(chunk => this.openaiService.transcribeAudio(chunk))
        );

        // Połącz transkrypcje
        transcription = transcriptions.join(' ');

        // Wyczyść pliki tymczasowe
        await Promise.all(chunks.map(chunk => fs.unlink(chunk)));
      }

      // Wyczyść plik wejściowy
      await fs.unlink(inputFile);
      
      return transcription;
    } catch (error) {
      console.error('Błąd podczas transkrypcji:', error);
      throw error;
    }
  }

  private splitAudioFile(inputFile: string, outputDir: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];

      ffmpeg(inputFile)
        .outputOptions([
          `-f segment`,
          `-segment_time ${300}`, // 5 minut na chunk
          `-c copy`               // Kopiuj bez przekodowania
        ])
        .on('end', () => resolve(chunks))
        .on('error', reject)
        .on('start', (cmd) => console.log('Rozpoczęto dzielenie pliku:', cmd))
        .on('progress', (progress) => {
          console.log(`Przetwarzanie: ${progress.percent}%`);
        })
        .output(path.join(outputDir, `chunk_%03d.${path.extname(inputFile).slice(1)}`))
        .on('filenames', (filenames) => {
          filenames.forEach(filename => {
            chunks.push(path.join(outputDir, filename));
          });
        })
        .run();
    });
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