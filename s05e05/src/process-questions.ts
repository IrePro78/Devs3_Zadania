import { config } from 'dotenv';
import { QuestionsService } from './services/questions.service';
import * as path from 'path';

config();

async function main() {
  try {
    const questionsService = new QuestionsService();
    const questionsPath = path.join('data', 'story.json');
    const outputPath = path.join('data', 'answers.json');

    console.log('Rozpoczynam przetwarzanie pytań...');
    await questionsService.processQuestions(questionsPath, outputPath);
    console.log('\n✓ Zakończono przetwarzanie pytań');

  } catch (error) {
    console.error('Błąd podczas przetwarzania:', error);
    process.exit(1);
  }
}

main(); 