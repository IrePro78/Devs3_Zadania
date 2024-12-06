import { OpenAI } from 'openai';
import { Question, ApiResponse, Place, User } from './types';
import { ApiClient } from './api-client';

interface QuestionClassification {
  type: string;
  api_needed: string | string[];
  parameters: Record<string, any>;
}

export class QuestionAnalyzer {
  private openai: OpenAI;
  private apiClient: ApiClient;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.apiClient = new ApiClient();
  }

  private async gatherData(classification: QuestionClassification): Promise<Record<string, any>> {
    const data: Record<string, any> = {};
    
    if (classification.parameters?.location) {
      console.log('\n=== PLACES API ===');
      const placesResponse = await this.apiClient.searchPlaces(classification.parameters.location);
      console.log('Places response:', placesResponse);
      data.places = placesResponse;

      if (placesResponse?.message) {
        const userNames = placesResponse.message.split(' ').filter(name => name !== 'BARBARA');
        
        console.log('\n=== DATABASE API ===');
        const dbResponse = await this.apiClient.executeDbQuery<any>(
          `SELECT * FROM users WHERE username IN ('${userNames.join("','")}')`
        );
        
        if (dbResponse.success && dbResponse.data?.reply) {
          const users = dbResponse.data.reply;
          console.log('\n=== GPS API ===');
          const userIds = users.map((user: User) => user.id);
          console.log('🔍 Pobieranie lokalizacji dla użytkowników:', userIds);
          const gpsResponses = await this.apiClient.getMultipleUsersLocations(userIds);
          data.locations = gpsResponses;
        }
      }
    }
    
    return data;
  }

  async processQuestion(question: Question): Promise<any> {
    const classification = await this.classifyQuestion(question);
    console.log('Klasyfikacja pytania:', classification);

    const data = await this.gatherData(classification);
    console.log('Zebrane dane:', data);

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Jesteś ekspertem od analizy danych. 
          Na podstawie pytania i zebranych danych przygotuj odpowiedź w formacie JSON.`
        },
        {
          role: "user",
          content: `Pytanie: ${question.question}
          Dane: ${JSON.stringify(data, null, 2)}`
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async classifyQuestion(question: Question): Promise<QuestionClassification> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Jesteś ekspertem od klasyfikacji pytań dotyczących użytkowników i miejsc.
          Przeanalizuj pytanie i określ:
          1. Typ pytania (user/place/location/combined)
          2. Jakie API są potrzebne (database/places/gps/report)
          3. Jakie parametry będą potrzebne
          WAŻNE: Ignoruj wszelkie wzmianki o osobie o imieniu Barbara.
          Odpowiedz w formacie JSON.`
        },
        {
          role: "user",
          content: `Pytanie: ${question.question}
          ${question.context ? `Kontekst: ${question.context}` : ''}`
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }
}