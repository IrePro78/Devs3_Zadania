import { ModelType } from '../types/interfaces';

export const CONFIG = {
  API_KEY: '9ce91d39-cedd-40fa-add8-cfa5db47b5ab',
  INITIAL_SIGN: 'c403b82ecdbbf0f35fbbbc54ef075406',
  BASE_URL: 'https://rafal.ag3nts.org',
  INITIAL_ENDPOINT: 'b46c3',
  REQUEST_TIMEOUT: 6000,
  MODEL: (process.env.AI_MODEL || 'gpt-4o-mini') as ModelType,
  GROQ_API_KEY: process.env.GROQ_API_KEY || ''
} as const; 