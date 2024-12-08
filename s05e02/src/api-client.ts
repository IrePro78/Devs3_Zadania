import { log } from 'console';
import { User, Place, GpsLocation, ReportData, ApiResponse, Coordinates } from './types';

interface GpsApiResponse {
  code: number;
  message: {
    lat: number;
    lon: number;
  };
}

export class ApiClient {
  private readonly dbApiUrl: string;
  private readonly placesApiUrl: string;
  private readonly gpsApiUrl: string;
  private readonly reportApiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.dbApiUrl = 'https://centrala.ag3nts.org/apidb';
    this.placesApiUrl = 'https://centrala.ag3nts.org/places';
    this.gpsApiUrl = 'https://centrala.ag3nts.org/gps';
    this.reportApiUrl = 'https://centrala.ag3nts.org/report';
    
    if (!process.env.API_KEY) {
      throw new Error('Brak klucza API w zmiennych środowiskowych');
    }
    this.apiKey = process.env.API_KEY;
  }

  private async fetchApi<T>(url: string, body: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      console.log(`\n🌐 Wysyłam zapytanie do ${url}`);
      console.log('📤 Wysyłane dane:', JSON.stringify(body, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      console.log('📥 Otrzymana odpowiedź:', JSON.stringify(data, null, 2));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('❌ Błąd podczas zapytania:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Nieznany błąd'
      };
    }
  }

  async executeDbQuery<T>(query: string): Promise<ApiResponse<T>> {
    const response = await this.fetchApi<T>(this.dbApiUrl, {
      task: "database",
      apikey: this.apiKey,
      query
    });

    if (response && 'reply' in response && response.error === 'OK') {
      return {
        success: true,
        data: response.reply as T
      };
    }

    return {
      success: false,
      error: response.error || 'Unknown error'
    };
  }

  async searchPlaces(query: string): Promise<ApiResponse<Place>> {
    return this.fetchApi<Place>(this.placesApiUrl, {
      apikey: this.apiKey,
      query: query
    });
  }

  private formatLocationResponse(results: Record<string, ApiResponse<GpsLocation>>, users: User[]): Record<string, { lat: number; lon: number }> {
    const formattedLocations: Record<string, { lat: number; lon: number }> = {};
    
    for (const [userId, response] of Object.entries(results)) {
      if (response.success && response.data) {
        const user = users.find(u => u.id === userId);
        if (user) {
          formattedLocations[user.username] = {
            lat: response.data.lat,
            lon: response.data.lon
          };
        }
      }
    }
    
    return formattedLocations;
  }

  async getUserLocation(userId: string): Promise<ApiResponse<GpsLocation>> {
    const rawResponse = await this.fetchApi<any>(this.gpsApiUrl, {
      task: "location",
      apikey: this.apiKey,
      userID: userId
    });

    if (rawResponse?.code === 0 && typeof rawResponse.message === 'object') {
      const coords = rawResponse.message as { lat: number; lon: number };
      
      return {
        success: true,
        data: {
          lat: coords.lat,
          lon: coords.lon
        }
      };
    }

    return {
      success: false,
      error: rawResponse.error || 'Unknown error'
    };
  }

  async getMultipleUsersLocations(userIds: string[], users: User[]): Promise<Record<string, { lat: number; lon: number }>> {
    console.log('\n📍 Pobieranie lokalizacji dla użytkowników:', userIds);
    const results: Record<string, ApiResponse<GpsLocation>> = {};
    
    for (const userId of userIds) {
      console.log(`\n🔍 Sprawdzanie lokalizacji użytkownika ${userId}`);
      results[userId] = await this.getUserLocation(userId);
      console.log(results[userId], 'results[userId]');
    }
    
    const formattedResults = this.formatLocationResponse(results, users);
    // console.log('\n📍 Zebrane lokalizacje:', JSON.stringify(formattedResults, null, 2));
    
    return formattedResults;
  }

  async getReport(): Promise<ApiResponse<ReportData>> {
    return this.fetchApi<ReportData>(this.reportApiUrl, {
      apikey: this.apiKey
    });
  }

  async sendReport(locations: Record<string, { lat: number; lon: number }>): Promise<ApiResponse<any>> {
    return this.fetchApi(this.reportApiUrl, {
      task: "gps",
      apikey: this.apiKey,
      answer: locations
    });
  }

} 