import { config } from 'dotenv';

import { AIService } from './services/ai.service';
import { QuestionsService } from './services/questions.service';

async function main(): Promise<void> {
  config();

  const questionsService = new QuestionsService();
  const aiService = new AIService();

  try {
    await questionsService.downloadAndSaveQuestions();
    const questions = await questionsService.readQuestions();
    
    console.log('Processing questions with AI...\n');
    
    for (const question of questions) {
      console.log(`Question: ${question}`);
      const aiResponse = await aiService.getResponse(question);
      console.log('AI Response:', aiResponse);
      console.log('---\n');
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Application failed: ${error.message}`);
    } else {
      console.error('Application failed: Unknown error');
    }
    process.exit(1);
  }
}

main(); 