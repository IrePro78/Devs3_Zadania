import { log } from 'console';
import { User, Place, GpsLocation, ReportData, ApiResponse } from './types';

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
    const response = await this.fetchApi<{ reply: T }>(this.dbApiUrl, {
      task: "database",
      apikey: this.apiKey,
      query
    });

    if (response.success && response.data) {
      return {
        success: true,
        data: response.data.reply
      };
    }

    return {
      success: false,
      error: response.error
    };
  }

  async searchPlaces(query: string): Promise<ApiResponse<Place>> {
    return this.fetchApi<Place>(this.placesApiUrl, {
      apikey: this.apiKey,
      query: query
    });
  }

  // Metody pomocnicze wykorzystujące executeDbQuery
  async getUserData(userId: string): Promise<ApiResponse<User>> {
    return this.executeDbQuery<User>(`SELECT * FROM users WHERE id = '${userId}' LIMIT 1`);
  }

  async getUserPlaces(userId: string): Promise<ApiResponse<Place[]>> {
    return this.executeDbQuery<Place[]>(`SELECT * FROM places WHERE user_id = '${userId}'`);
  }

  async getPlaceDetails(placeId: string): Promise<ApiResponse<Place>> {
    return this.executeDbQuery<Place>(`SELECT * FROM places WHERE id = '${placeId}' LIMIT 1`);
  }

  async searchUsers(query: string): Promise<ApiResponse<User[]>> {
    return this.executeDbQuery<User[]>(
      `SELECT * FROM users WHERE name ILIKE '%${query}%' OR role ILIKE '%${query}%'`
    );
  }

  async getUserLocation(userId: string): Promise<ApiResponse<GpsLocation>> {
    return this.fetchApi<GpsLocation>(this.gpsApiUrl, {
      task: "location",
      apikey: this.apiKey,
      userId
    });
  }

  // Metoda pomocnicza do sprawdzania ostatniej lokalizacji wielu użytkowników
  async getMultipleUsersLocations(userIds: string[]): Promise<Record<string, ApiResponse<GpsLocation>>> {
    const results: Record<string, ApiResponse<GpsLocation>> = {};
    
    for (const userId of userIds) {
      results[userId] = await this.getUserLocation(userId);
    }
    
    return results;
  }

  async getReport(): Promise<ApiResponse<ReportData>> {
    return this.fetchApi<ReportData>(this.reportApiUrl, {
      apikey: this.apiKey
    });
  }

  async getUsersByLocation(places: any[]): Promise<string[]> {
    const response = await this.fetchApi<string[]>(this.dbApiUrl, {
      task: "users_by_location",
      apikey: this.apiKey,
      places
    });
    return response.success && response.data ? response.data : [];
  }

  async getUsersByNames(names: string[]): Promise<ApiResponse<User[]>> {
    const namesString = names.map(name => `'${name}'`).join(',');
    return this.executeDbQuery<User[]>(
      `SELECT id FROM users WHERE username IN (${namesString})`
    );
  }
} 