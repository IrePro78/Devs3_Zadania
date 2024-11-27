import { OpenAI } from 'openai';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface PersonDescription {
    generalAppearance: string;
    similarities: string[];
    differences: string[];
    confidence: number;
}

export class PersonImageAnalyzer {
    private openai: OpenAI;

    constructor(apiKey: string) {
        this.openai = new OpenAI({ apiKey });
        console.log('🚀 Inicjalizacja analizatora obrazów...');
    }

    async analyzeImages(imageDirectory: string): Promise<string> {
        console.log(`\n📁 Skanowanie katalogu: ${imageDirectory}`);
        
        const imageFiles = fs.readdirSync(imageDirectory)
            .filter(file => /\.(jpg|jpeg|png)$/i.test(file));
        
        console.log(`📸 Znaleziono ${imageFiles.length} zdjęć do analizy\n`);

        // Wczytaj wszystkie zdjęcia do bufora
        const imageBuffers = imageFiles.map(file => {
            const imagePath = path.join(imageDirectory, file);
            return fs.readFileSync(imagePath);
        });

        try {
            console.log('⏳ Analizowanie i porównywanie wszystkich zdjęć...');
            const analysis = await this.compareImages(imageBuffers);
            
            // Zapisz wynik do pliku
            const outputDir = './rysopisy';
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filePath = path.join(outputDir, `analiza_porownawcza_${timestamp}.txt`);
            await fs.promises.writeFile(filePath, analysis, 'utf-8');
            
            console.log(`📝 Zapisano analizę do pliku: analiza_porownawcza_${timestamp}.txt`);
            
            return analysis;
        } catch (error) {
            console.error('❌ Błąd podczas analizy:', error);
            throw error;
        }
    }

    private async compareImages(imageBuffers: Buffer[]): Promise<string> {
        const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Przeanalizuj dokładnie dostarczone zdjęcia. Na każdym z nich znajduje się ta sama osoba. Opisz tę osobę szczegółowo, uwzględniając:

1. Płeć i przybliżony wiek
2. Kolor oczu i włosów
3. Fryzurę i styl włosów
4. Kształt twarzy i charakterystyczne cechy (np. kształt nosa, ust, brwi)
5. Budowę ciała i przybliżony wzrost
6. Widoczne znaki szczególne (np. pieprzyki, blizny, tatuaże)
7. Styl ubierania się, jeśli jest charakterystyczny

Opisz tę osobę w formie ciągłego tekstu po polsku, jakbyś opisywał ją komuś, kto jej nie widział. Skup się na cechach, które powtarzają się na wszystkich zdjęciach.`
                        },
                        ...imageBuffers.map(buffer => ({
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
                                detail: "high"
                            }
                        } as const))
                    ]
                }
            ],
            max_tokens: 1500
        });

        return response.choices[0].message.content ?? 'Nie udało się wygenerować opisu.';
    }
} 