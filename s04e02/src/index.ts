import { ConversationConverter } from './converter';
import { FineTuner } from './fine-tuner';
import * as path from 'node:path';
import { config } from 'dotenv';

config();

async function main() {
    const sourcePath = path.join(__dirname, '..', 'sources');
    const outputPath = path.join(__dirname, '..', 'output');
    const jsonlPath = path.join(outputPath, 'fine_tune_data.jsonl');

    console.log('🎯 Uruchamianie procesu konwersji i fine-tuningu...');
    
    try {
        // Konwersja danych
        const converter = new ConversationConverter(sourcePath, outputPath);
        await converter.convertToJsonl();

        // Fine-tuning
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('Brak klucza API OpenAI. Ustaw zmienną środowiskową OPENAI_API_KEY');
        }

        console.log('\n🔄 Rozpoczynanie procesu fine-tuningu...');
        const fineTuner = new FineTuner(apiKey);
        await fineTuner.startFineTuning(jsonlPath);

    } catch (error) {
        console.error('\n❌ Wystąpił błąd:', error);
        process.exit(1);
    }
}

main(); 