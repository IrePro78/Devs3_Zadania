import { CONFIG } from '../config/constants';
import { InitialRequest, InitialResponse, ChallengeResponse, FinalAnswer } from '../types/interfaces';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

export class QuizService {
  private readonly baseUrl: string;
  private readonly openai: OpenAI;
  private readonly arxivContent: string;

  constructor() {
    this.baseUrl = CONFIG.BASE_URL;
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.arxivContent = fs.readFileSync(
      path.join(__dirname, '../../arxiv-draft.md'),
      'utf-8'
    );
  }

  public async executeChallenge(): Promise<FinalAnswer> {
    const startTime = Date.now();
    console.log('\nRozpoczęcie wykonywania zadania...');

    try {
      const [sign, arxivPrompt] = await Promise.all([
        this.getInitialSign(),
        this.prepareContextPrompt()
      ]);
      console.log('Otrzymany sign:', sign);

      const initialResponse = await this.sendInitialRequest(sign);
      console.log(`Pobranie początkowych danych: ${(Date.now() - startTime)/1000}s`);

      const challenges = await this.fetchChallenges(initialResponse.message.challenges);
      console.log(`Pobranie pytań: ${(Date.now() - startTime)/1000}s`);

      const contextQuestions: string[] = [];
      const generalQuestions: string[] = [];

      challenges.forEach(challenge => {
        const isContextBased = challenge.task.includes('arxiv-draft.html');
        challenge.data.forEach(question => {
          if (isContextBased) {
            contextQuestions.push(question);
          } else {
            generalQuestions.push(question);
          }
        });
      });

      const [contextAnswers, generalAnswers] = await Promise.all([
        Promise.all(contextQuestions.map(q => this.getAnswerFromContext(q, arxivPrompt))),
        Promise.all(generalQuestions.map(q => this.getGeneralAnswer(q)))
      ]);

      const answers = challenges.flatMap(challenge => {
        const isContextBased = challenge.task.includes('arxiv-draft.html');
        return challenge.data.map(question => {
          const questionList = isContextBased ? contextQuestions : generalQuestions;
          const answerList = isContextBased ? contextAnswers : generalAnswers;
          const index = questionList.indexOf(question);
          const answer = answerList[index];
          console.log('\nPytanie:', question);
          console.log('Odpowiedź:', answer);
          console.log('-'.repeat(50));
          return answer;
        });
      });

      console.log(`Przygotowanie odpowiedzi: ${(Date.now() - startTime)/1000}s`);

      const finalAnswer = {
        apikey: CONFIG.API_KEY,
        timestamp: initialResponse.message.timestamp,
        signature: initialResponse.message.signature,
        answer: answers
      };

      await this.sendFinalAnswer(finalAnswer);
      console.log(`\nCałkowity czas wykonania: ${(Date.now() - startTime)/1000}s`);

      return finalAnswer;
    } catch (error) {
      console.error(`\nBłąd po ${(Date.now() - startTime)/1000}s wykonania:`, error);
      throw error;
    }
  }

  private async getInitialSign(): Promise<string> {
    const request = {
      apikey: CONFIG.API_KEY,
      password: "NONOMNISMORIAR"
    };

    const response = await fetch(`${this.baseUrl}/${CONFIG.INITIAL_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.message;
  }

  private async sendInitialRequest(sign: string): Promise<InitialResponse> {
    const request: InitialRequest = {
      apikey: CONFIG.API_KEY,
      sign: sign
    };

    const response = await fetch(`${this.baseUrl}/${CONFIG.INITIAL_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private async fetchChallenges(urls: string[]): Promise<ChallengeResponse[]> {
    const requests = urls.map(async (url) => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    });

    return Promise.all(requests);
  }

  private async warmupOpenAI(): Promise<void> {
    await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1
    });
  }

  private async prepareContextPrompt(): Promise<string> {
    return `Kontekst: ${this.arxivContent}\n\nPytanie:`;
  }

  private async prepareAnswersBatched(challenges: ChallengeResponse[], contextPrompt: string): Promise<string[]> {
    const allQuestions = challenges.flatMap(challenge => 
      challenge.data.map(question => ({
        question,
        useContext: challenge.task.includes('arxiv-draft.html')
      }))
    );

    const answers: string[] = [];
    const batchSize = 2;

    for (let i = 0; i < allQuestions.length; i += batchSize) {
      const batch = allQuestions.slice(i, i + batchSize);
      const batchAnswers = await Promise.all(
        batch.map(({ question, useContext }) => 
          useContext 
            ? this.getAnswerFromContext(question, contextPrompt)
            : this.getGeneralAnswer(question)
        )
      );
      answers.push(...batchAnswers);
    }

    return answers;
  }

  private async getAnswerWithRetry(fn: () => Promise<string>, retries = 1): Promise<string> {
    try {
      return await Promise.race<string>([
        fn(),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI timeout')), 2000)
        )
      ]);
    } catch (error) {
      if (retries > 0) {
        console.log('Ponawiam próbę...');
        return this.getAnswerWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private async getAnswerFromContext(question: string, contextPrompt: string): Promise<string> {
    if (CONFIG.MODEL === 'groq') {
      return this.getGroqAnswer(`${contextPrompt}\n\nPytanie: ${question}`);
    }

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Odpowiadaj jednym zdaniem. Tylko fakty z kontekstu."
        },
        {
          role: "user",
          content: `${contextPrompt}\n\nPytanie: ${question}`
        }
      ],
      temperature: 0,
      max_tokens: 30,
      presence_penalty: -2.0,
      frequency_penalty: -2.0
    });

    return completion.choices[0].message.content || '';
  }

  private async getGeneralAnswer(question: string): Promise<string> {
    if (CONFIG.MODEL === 'groq') {
      return this.getGroqAnswer(question);
    }

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Odpowiadaj jednym zdaniem. Tylko fakty historyczne."
        },
        {
          role: "user",
          content: question
        }
      ],
      temperature: 0,
      max_tokens: 30,
      presence_penalty: -2.0,
      frequency_penalty: -2.0
    });

    return completion.choices[0].message.content || '';
  }

  private async getGroqAnswer(prompt: string): Promise<string> {
    const response = await fetch('https://api.groq.com/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: 'Odpowiadaj krótko i zwięźle, tylko faktami.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.0,
        max_tokens: 30,
        top_p: 1.0,
        stop: null
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  private async sendFinalAnswer(answer: FinalAnswer): Promise<void> {
    try {
      console.log('\nWysyłam odpowiedź:');
      console.log(JSON.stringify(answer, null, 2));
      
      const response = await fetch(`${this.baseUrl}/${CONFIG.INITIAL_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(answer),
        signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
      });

      const responseText = await response.text();
      console.log('\nOtrzymana odpowiedź:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('\nOdpowiedź wysłana pomyślnie');
      console.log('Status:', response.status);
      console.log('Odpowiedź serwera:', data);
    } catch (error) {
      console.error('Błąd podczas wysyłania odpowiedzi:', error);
      throw error;
    }
  }
} 