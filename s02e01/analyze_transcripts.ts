import 'dotenv/config';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import OpenAI from 'openai';

interface AnalysisResult {
  originalContent: string;
  context: string;
  timestamp: Date;
}

// Konfiguracja OpenAI z baseURL Groq
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || '',
  baseURL: 'https://api.groq.com/openai/v1',
});

async function readTranscriptions(): Promise<string> {
  const transcriptionPath = path.join(process.cwd(), 'transkrypcja_audio', 'transkrypcja.txt');
  
  if (!existsSync(transcriptionPath)) {
    throw new Error('Nie znaleziono pliku z transkrypcjami!');
  }

  return await fs.readFile(transcriptionPath, 'utf-8');
}

async function processTranscriptions(transcriptions: string): Promise<AnalysisResult> {
  try {
    console.log('Przetwarzam transkrypcje...');

    const completion = await openai.chat.completions.create({
      model: "mixtral-8x7b-32768",  // Model dostępny w Groq
      messages: [
        {
          role: "system",
          content: `Zachowaj oryginalny język (Polish)i treść transkrypcji. 
          Usuń tylko znaczniki czasowe i nazwy plików. 
          Nie wstawiaj tytułów ani znaczników czasowych.
          Połącz wszystkie transkrypcje w jeden spójny tekst.
          Nie tłumacz, nie streszczaj, zachowaj oryginalną formę wypowiedzi.
          Odpowiedz dokładnie tym samym tekstem, tylko bez znaczników czasowych i nazw plików.`
        },
        {
          role: "user",
          content: `Przetwórz poniższe transkrypcje zachowując ich oryginalną treść:\n\n${transcriptions}`
        }
      ],
      temperature: 0,  // Ustawione na 0 dla maksymalnej dokładności
      max_tokens: 4000
    });

    const processedText = completion.choices[0]?.message?.content || '';

    return {
      originalContent: transcriptions,
      context: processedText,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Błąd podczas przetwarzania:', error);
    throw error;
  }
}

async function saveProcessedText(analysis: AnalysisResult): Promise<void> {
  const outputPath = path.join(process.cwd(), 'transkrypcja_audio', 'kontekst.txt');
  


  await fs.writeFile(outputPath, analysis.context, 'utf-8');
  console.log(`\nZapisano kontekst do: ${outputPath}`);
}

async function main() {
  try {
    console.log('Rozpoczynam przetwarzanie transkrypcji...');
    
    const transcriptions = await readTranscriptions();
    const analysis = await processTranscriptions(transcriptions);
    await saveProcessedText(analysis);

    console.log('\nPrzetwarzanie zakończone pomyślnie!');
    console.log('\nWygenerowany kontekst został zapisany do pliku kontekst.txt');

  } catch (error) {
    console.error('Wystąpił błąd:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main(); 