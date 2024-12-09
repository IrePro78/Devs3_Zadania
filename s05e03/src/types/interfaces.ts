export interface InitialRequest {
  apikey: string;
  sign: string;
}

export interface InitialResponse {
  code: number;
  message: {
    signature: string;
    timestamp: number;
    challenges: string[];
  };
}

export interface ChallengeResponse {
  task: string;
  data: string[];
}

export interface FinalAnswer {
  apikey: string;
  timestamp: number;
  signature: string;
  answer: string[];
}

export type ModelType = 'gpt-4o-mini' | 'groq'; 