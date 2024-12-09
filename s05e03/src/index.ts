import { QuizService } from './services/quiz-service';
import dotenv from 'dotenv';

dotenv.config();

async function main(): Promise<void> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Brak klucza OPENAI_API_KEY w zmiennych środowiskowych');
    }

    const quizService = new QuizService();
    const result = await quizService.executeChallenge();
    
    // Formatowanie odpowiedzi zgodnie z wymaganiami
    const formattedResponse = {
      apikey: result.apikey,
      timestamp: result.timestamp,
      signature: result.signature,
      answer: result.answer
    };

    console.log(JSON.stringify(formattedResponse, null, 2));
  } catch (error) {
    console.error('Wystąpił błąd:', error);
    process.exit(1);
  }
}

main(); 