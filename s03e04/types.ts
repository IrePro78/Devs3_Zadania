export interface Person {
  name: string;
  lastSeenAt: string;
  knownAssociates: string[];
  locations: string[];
}

export interface Place {
  name: string;
  visitedBy: string[];
  events: string[];
}

export interface ApiResponse<T> {
  data: T[];
  status: number;
}

export interface TextAnalysisResult {
  people: string[];
  places: string[];
} 