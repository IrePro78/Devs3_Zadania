import { config } from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Question } from './types';
import { QuestionAnalyzer } from './question-analyzer';

config();

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Brak klucza OPENAI_API_KEY w zmiennych środowiskowych');
  }

  try {
    // Wczytaj pytanie z pliku
    const questionPath = join(__dirname, '..', 'question.json');
    const questionData = await readFile(questionPath, 'utf-8');
    const question: Question = JSON.parse(questionData);

    // Przetwórz pytanie
    const analyzer = new QuestionAnalyzer(process.env.OPENAI_API_KEY);
    const result = await analyzer.processQuestion(question);

    // Zapisz wynik do pliku
    const outputPath = join(__dirname, '..', 'output', 'result.json');
    await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    
    // Wyświetl wynik
    // console.log('Wynik:', JSON.stringify(result, null, 2));
    // console.log('\n✅ Wynik został zapisany do:', outputPath);
  } catch (error) {
    console.error('Wystąpił błąd:', error);
    process.exit(1);
  }
}

main(); 