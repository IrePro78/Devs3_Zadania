import { config } from 'dotenv';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { QAProcessor } from './qa-processor';
import { dirname } from 'path';

config();

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const directory = dirname(filePath);
  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Brak klucza OPENAI_API_KEY w zmiennych środowiskowych');
  }

  const processor = new QAProcessor(process.env.OPENAI_API_KEY);
  
  try {
    console.log('Inicjalizacja procesora...');
    await processor.initialize();

    console.log('Przetwarzanie pytań...');
    const questionsPath = join(__dirname, '..', 'data', 'questions.json');
    const answers = await processor.processQuestions(questionsPath);

    // Zapisz wyniki
    const outputPath = join(__dirname, '..', 'output', 'answers.json');
    await ensureDirectoryExists(outputPath);
    await writeFile(outputPath, JSON.stringify(answers, null, 2));

    console.log(`Zapisano odpowiedzi do: ${outputPath}`);
  } catch (error) {
    console.error('Wystąpił błąd:', error);
    process.exit(1);
  }
}

main(); 