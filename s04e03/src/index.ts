import { QuestionReader } from './services/question-reader.service';
import { WebCrawler } from './services/web-crawler.service';
import { writeFileSync } from 'fs';
import { Answer } from './types/question.type';
import dotenv from 'dotenv';

dotenv.config();

class Application {
  private questionReader: QuestionReader;
  private webCrawler: WebCrawler;

  constructor() {
    this.questionReader = new QuestionReader();
    this.webCrawler = new WebCrawler();
  }

  public async run(): Promise<void> {
    const questions = this.questionReader.readQuestions('questions.json');
    
    const questionContents = questions.map(q => q.content);
    const answersMap = await this.webCrawler.findAnswers(questionContents);
    
    const answers: Answer[] = [];
    answersMap.forEach((answer, question) => {
      answers.push(answer);
    });

    this.saveAnswers(answers);
    console.log('\nZakończono przetwarzanie wszystkich pytań.');
  }

  private saveAnswers(answers: Answer[]): void {
    // Zapisz szczegółowe odpowiedzi do pliku txt
    const answersText = answers
      .map(
        (answer) =>
          `Pytanie: ${answer.question}\nOdpowiedź: ${answer.answer}\nŹródło: ${answer.sourceUrl}\n---\n`
      )
      .join('\n');
    writeFileSync('answers.txt', answersText, 'utf-8');
    console.log('Zapisano odpowiedzi do pliku answers.txt');

    // Zapisz sformatowane odpowiedzi do pliku JSON
    const formattedAnswers = answers.reduce((acc, answer, index) => {
      const key = `0${index + 1}`;
      acc[key] = answer.answer;
      return acc;
    }, {} as Record<string, string>);

    writeFileSync('answers.json', JSON.stringify(formattedAnswers, null, 2), 'utf-8');
    console.log('Zapisano sformatowane odpowiedzi do pliku answers.json');
  }
}

const app = new Application();
app.run().catch((error) => {
  console.error('Krytyczny błąd aplikacji:', error);
  process.exit(1);
}); 