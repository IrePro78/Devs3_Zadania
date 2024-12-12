import { QuestionsService } from './services/questions.service';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  try {
    const storyPath = path.join(process.cwd(), 'data', 'story.json');
    const answersPath = path.join(process.cwd(), 'data', 'answers.json');
    const storyContent = await fs.readFile(storyPath, 'utf-8');
    const questions = JSON.parse(storyContent);

    if (!Array.isArray(questions)) {
      console.error('Nieprawidłowa struktura pliku - oczekiwano tablicy pytań');
      process.exit(1);
    }

    console.log(`\nZnaleziono ${questions.length} pytań do przetworzenia.`);
    const questionsService = new QuestionsService();

    // Przechowuj odpowiedzi jako tablicę
    const answers: string[] = [];

    // Przetwarzaj pytania sekwencyjnie
    for (const [index, question] of questions.entries()) {
      const questionNumber = (index + 1).toString().padStart(2, '0');
      console.log(`\nPytanie ${questionNumber}: ${question}`);
      
      const answer = await questionsService.answerQuestion(question);
      console.log(`Odpowiedź: ${answer}`);
      
      // Dodaj odpowiedź na odpowiedniej pozycji w tablicy
      answers[index] = answer;

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Zapisz tablicę odpowiedzi do pliku
    await fs.writeFile(answersPath, JSON.stringify(answers, null, 2), 'utf-8');
    console.log('\nOdpowiedzi zostały zapisane do', answersPath);

  } catch (error) {
    console.error('Błąd podczas przetwarzania pytań:', error);
    process.exit(1);
  }
}

main(); 