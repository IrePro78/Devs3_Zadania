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
      // console.log('Places response:', placesResponse);
      data.places = placesResponse;

      if (placesResponse?.message) {
        const userNames = placesResponse.message.split(' ').filter(name => name !== 'BARBARA');
        // console.log('Znalezione nazwy użytkowników:', userNames);
        
        console.log('\n=== DATABASE API ===');
        const dbResponse = await this.apiClient.executeDbQuery<User[]>(
          `SELECT * FROM users WHERE username IN ('${userNames.join("','")}')`
        );
                
        // console.log('Database response:', JSON.stringify(dbResponse, null, 2));
        
        if (dbResponse.success && Array.isArray(dbResponse.data)) {
          const users = dbResponse.data;
          // console.log('Znalezieni użytkownicy:', users);
          
          console.log('\n=== GPS API ===');
          const userIds = users.map((user: User) => user.id);
          console.log('🔍 Pobieranie lokalizacji dla użytkowników:', userIds);
          
          const gpsResponses = await this.apiClient.getMultipleUsersLocations(userIds, users);
          // console.log('GPS responses:', gpsResponses);
          data.locations = gpsResponses;
        } else {
          console.log('⚠️ Nie udało się pobrać danych użytkowników lub dane są niepoprawne');
          console.log('dbResponse:', dbResponse);
        }
      }
    }
    
    return data;
  }

  async processQuestion(question: Question): Promise<any> {
    const classification = await this.classifyQuestion(question);
    const data = await this.gatherData(classification);

    if (data.locations && Object.keys(data.locations).length > 0) {
      // Wysyłamy raport do API
      const reportResponse = await this.apiClient.sendReport(data.locations);
      
      // Zwracamy zarówno lokalizacje jak i odpowiedź z API raportu
      return {
        locations: data.locations,
        reportResponse
      };
    }
    
    return {
      "info": "Nie znaleziono lokalizacji dla żadnego użytkownika"
    };
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