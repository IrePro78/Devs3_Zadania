import * as fs from 'fs/promises';
import * as path from 'path';
import { Questions } from '../interfaces/questions.interface';

export class QuestionsService {
  private readonly dataDir = 'data/questions';
  private readonly fileName = 'questions.json';

  constructor() {
    fs.mkdir(this.dataDir, { recursive: true });
  }

  public async downloadAndSaveQuestions(): Promise<void> {
    const { API_KEY } = process.env;
    if (!API_KEY) {
      throw new Error('API_KEY is not defined in environment variables');
    }

    const url = `https://centrala.ag3nts.org/data/${API_KEY}/story.json`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const questions = await response.json() as Questions;
      
      const filePath = path.join(this.dataDir, this.fileName);
      await fs.writeFile(filePath, JSON.stringify(questions, null, 2));
      console.log(`Questions saved to ${filePath}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Failed to fetch and save questions: ${error.message}`);
      } else {
        console.error('Failed to fetch and save questions: Unknown error');
      }
      throw error;
    }
  }

  public async readQuestions(): Promise<Questions> {
    const filePath = path.join(this.dataDir, this.fileName);
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent) as Questions;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Failed to read questions file: ${error.message}`);
      } else {
        console.error('Failed to read questions file: Unknown error');
      }
      throw error;
    }
  }
} 