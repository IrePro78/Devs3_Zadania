import { config } from 'dotenv';
import { PhoneProcessor } from './phone-processor';

config();

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Brak klucza OPENAI_API_KEY w zmiennych środowiskowych');
  }

  const processor = new PhoneProcessor(process.env.OPENAI_API_KEY);
  
  try {
    console.log('Rozpoczynam przetwarzanie rozmów telefonicznych...');
    await processor.processPhoneData();
    console.log('Przetwarzanie zakończone pomyślnie');
  } catch (error) {
    console.error('Wystąpił błąd:', error);
    process.exit(1);
  }
}

main(); 