import { PersonImageAnalyzer } from './image-analyzer';
import { config } from 'dotenv';
import * as path from 'node:path';

config();

async function main() {
    console.log('\n🔐 Sprawdzanie konfiguracji...');
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
        console.error('❌ Błąd: Brak klucza API OpenAI');
        throw new Error('Brak klucza API OpenAI. Ustaw zmienną środowiskową OPENAI_API_KEY');
    }
    console.log('✅ Znaleziono klucz API');

    const analyzer = new PersonImageAnalyzer(apiKey);
    const descriptions = await analyzer.analyzeImages('./images');
    
    console.log('\n✨ Analiza zakończona pomyślnie!');
    console.log(`📊 Przeanalizowano ${descriptions.length} zdjęć`);
    console.log('📁 Rysopisy zostały zapisane w katalogu "./rysopisy"');
}

console.log('🎯 Uruchamianie programu analizy zdjęć...');
main().catch(error => {
    console.error('\n❌ Wystąpił błąd podczas wykonywania programu:', error);
    process.exit(1);
}); 