import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly openAiApi: OpenAI;
  private readonly PASSWORD_RESPONSE = 'S2FwaXRhbiBCb21iYTsp';

  constructor(private readonly configService: ConfigService) {
    this.openAiApi = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async getShortAnswer(question: string): Promise<string> {
    console.log('Wywołano getShortAnswer z pytaniem:', question);
    
    if (this.isPasswordQuestion(question)) {
      console.log('Wykryto pytanie o hasło');
      return this.PASSWORD_RESPONSE;
    }

    try {
      const completion = await this.openAiApi.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Odpowiadaj krótko i zwięźle na zadane pytania.' },
          { role: 'user', content: question }
        ],
        max_tokens: 100,
        temperature: 0.7,
      });
      
      console.log('Otrzymano odpowiedź z OpenAI');
      return completion.choices[0]?.message?.content || 'Przepraszam, nie mogę teraz odpowiedzieć na to pytanie.';
    } catch (error) {
      console.error('Błąd podczas wywoływania OpenAI:', error);
      return 'Wystąpił błąd podczas przetwarzania pytania.';
    }
  }

  private isPasswordQuestion(question: string): boolean {
    const passwordKeywords = ['hasło', 'password', 'pass', 'kod'];
    return passwordKeywords.some(keyword => 
      question.toLowerCase().includes(keyword)
    );
  }
} 