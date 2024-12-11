import OpenAI from 'openai';

export class AIService {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  public async getResponse(question: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [{ role: "user", content: question }],
        model: "gpt-4o-mini",
      });

      return completion.choices[0].message.content || 'Nie udało się uzyskać odpowiedzi';
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`OpenAI API error: ${error.message}`);
      } else {
        console.error('OpenAI API error: Unknown error');
      }
      throw error;
    }
  }
} 