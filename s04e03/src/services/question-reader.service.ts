import { readFileSync } from 'fs';
import { Question } from '../types/question.type';
import { CONFIG } from '../config/config';

export class QuestionReader {
  public readQuestions(filePath: string): Question[] {
    try {
      // Wczytaj zawartość pliku JSON
      const fileContent = readFileSync(filePath, 'utf-8');
      const questionsJson = JSON.parse(fileContent);
      
      // Przekształć obiekt JSON na tablicę pytań
      return Object.entries(questionsJson).map(([key, content]) => ({
        content: content as string,
        url: CONFIG.BASE_URL
      }));
    } catch (error) {
      console.error('Błąd podczas wczytywania pytań:', error);
      throw error;
    }
  }
} 