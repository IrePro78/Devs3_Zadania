import 'dotenv/config';
import fs from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import OpenAI from 'openai';

// Interfejsy
interface AudioFileInfo {
  fileName: string;
  size: string;
  path: string;
}

interface TranscriptionResult {
  fileName: string;
  text: string;
  timestamp: Date;
}

// Konfiguracja OpenAI z baseURL Groq
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || '',
  baseURL: 'https://api.groq.com/openai/v1',
});

async function transcribeAudio(audioPath: string): Promise<TranscriptionResult> {
  try {
    const fileName = path.basename(audioPath);
    console.log(`Rozpoczynam transkrypcję pliku: ${fileName}`);

    const transcription = await openai.audio.transcriptions.create({
      file: new File([await fs.readFile(audioPath)], path.basename(audioPath), { type: 'audio/m4a' }),
      model: "whisper-large-v3-turbo",
      language: "pl",
      response_format: "text",
    });

    return {
      fileName,
      text: transcription || 'Nie udało się przetworzyć audio',
      timestamp: new Date()
    };
  } catch (error) {
    console.error(`Błąd podczas transkrypcji ${audioPath}:`, error);
    throw error;
  }
}

async function main() {
  try {
    const sourceDirectory = path.join(process.cwd(), 'source_audio');
    
    if (!existsSync(sourceDirectory)) {
      throw new Error(`Katalog ${sourceDirectory} nie istnieje!`);
    }

    const files = await fs.readdir(sourceDirectory);
    const audioFiles = files
      .filter(file => file.toLowerCase().endsWith('.m4a'))
      .map(file => ({
        fileName: file,
        path: path.join(sourceDirectory, file),
        size: `${(statSync(path.join(sourceDirectory, file)).size / (1024 * 1024)).toFixed(2)} MB`
      }));

    if (audioFiles.length === 0) {
      throw new Error('Nie znaleziono plików .m4a');
    }

    console.log('Znalezione pliki audio:');
    console.table(audioFiles);

    const transcriptions: TranscriptionResult[] = [];
    for (const file of audioFiles) {
      const transcription = await transcribeAudio(file.path);
      transcriptions.push(transcription);
      console.log(`Zakończono transkrypcję: ${file.fileName}`);
    }

    const outputPath = path.join(process.cwd(), 'transkrypcja_audio', 'transkrypcja.txt');
    const outputContent = transcriptions
      .map(t => `[${t.timestamp.toISOString()}] ${t.fileName}\n${t.text}\n${'='.repeat(80)}`)
      .join('\n\n');

    await fs.writeFile(outputPath, outputContent, 'utf-8');
    console.log(`\nZapisano wyniki do: ${outputPath}`);

  } catch (error) {
    console.error('Błąd:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main(); 