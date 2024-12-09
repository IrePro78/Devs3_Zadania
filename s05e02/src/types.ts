export interface User {
  id: string;
  username: string;
  access_level: string;
  is_active: string;
  lastlog: string;
}

export interface Place {
  code: number;
  message: string;
}

export interface GpsLocation {
  userId: string;
  timestamp: string;
  location: {
    lat: number;
    lng: number;
  };
  accuracy?: number;
}

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  code?: number;
  message?: string;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface ReportData {
  [key: string]: Coordinates;
}

export interface Question {
  question: string;
  context?: string;
}

export interface QuestionClassification {
  type: 'user' | 'place' | 'location' | 'combined';
  requiredApis: ('database' | 'places' | 'gps' | 'report')[];
  parameters?: {
    userId?: string;
    placeId?: string;
    query?: string;
  };
}

export interface PlaceResponse {
  code: number;
  message: string;
}

export interface GpsApiResponse {
  code: number;
  message: GpsLocation;
} 