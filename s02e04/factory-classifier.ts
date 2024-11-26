import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream } from 'fs';
import dotenv from 'dotenv';
import { File } from 'buffer';

dotenv.config();

interface ClassificationResult {
  people: string[];
  hardware: string[];
}

class FactoryClassifier {
  private openai: OpenAI;
  private readonly ALLOWED_EXTENSIONS = ['.txt', '.png', '.mp3'];

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Brak klucza API OpenAI w zmiennych środowiskowych!');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async classifyFiles(): Promise<ClassificationResult> {
    const result: ClassificationResult = {
      people: [],
      hardware: [],
    };

    try {
      // Odczytaj wszystkie pliki z katalogu
      const files = await fs.readdir('pliki_fabryki');
      console.log(`\nZnaleziono ${files.length} plików w katalogu pliki_fabryki`);
      
      for (const file of files) {
        console.log(`\n=== Przetwarzanie pliku: ${file} ===`);
        
        const ext = path.extname(file);
        if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
          console.log(`Pomijam plik ${file} - nieobsługiwane rozszerzenie ${ext}`);
          continue;
        }

        console.log(`Rozpoczynam analizę pliku ${file}...`);
        const content = await this.processFile(file, ext);
        
        if (!content) {
          console.log(`Nie udało się przetworzyć pliku ${file}`);
          continue;
        }
        console.log(`Plik ${file} został pomyślnie przetworzony`);

        // Klasyfikacja za pomocą GPT-4
        console.log(`Klasyfikuję zawartość pliku ${file}...`);
        const category = await this.classifyContent(content);
        
        if (category === 'people') {
          console.log(`Plik ${file} został sklasyfikowany jako: LUDZIE`);
          result.people.push(file);
        } else if (category === 'hardware') {
          console.log(`Plik ${file} został sklasyfikowany jako: MASZYNY`);
          result.hardware.push(file);
        } else {
          console.log(`Plik ${file} nie pasuje do żadnej kategorii`);
        }
      }

      console.log('\n=== Podsumowanie klasyfikacji ===');
      console.log(`Pliki dotyczące ludzi: ${result.people.length}`);
      console.log(`Pliki dotyczące maszyn: ${result.hardware.length}`);

      // Zapisz wynik do pliku JSON
      await fs.writeFile(
        'classification_result.json', 
        JSON.stringify(result, null, 2)
      );
      console.log('\nWyniki zostały zapisane do pliku classification_result.json');

      return result;

    } catch (error) {
      console.error('Wystąpił błąd:', error);
      throw error;
    }
  }

  private async processFile(filename: string, extension: string): Promise<string | null> {
    const filepath = path.join('pliki_fabryki', filename);

    switch (extension) {
      case '.txt':
        console.log(`Odczytuję zawartość pliku tekstowego ${filename}...`);
        const textContent = await fs.readFile(filepath, 'utf-8');
        return textContent;

      case '.png':
        console.log(`Przetwarzam obraz ${filename}...`);
        const imageBuffer = await fs.readFile(filepath);
        
        if (!await this.validateImageSize(imageBuffer)) {
          console.error(`Plik ${filename} jest zbyt duży (max 4MB)`);
          return null;
        }
        console.log(`Rozmiar obrazu ${filename} jest prawidłowy`);
        
        try {
          console.log(`Analizuję obraz ${filename} za pomocą Vision API...`);
          
          const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "Jesteś ekspertem w analizie obrazów przemysłowych. Klasyfikuj obrazy TYLKO jeśli jesteś absolutnie pewien ich kategorii. W przypadku wątpliwości lub gdy obraz nie pasuje jednoznacznie do kategorii, odpowiedz 'none'."
              },
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: "Przeanalizuj ten obraz i odpowiedz TYLKO jednym słowem: 'people', 'hardware' lub 'none':\n" +
                          "- 'people' - TYLKO jeśli obraz JEDNOZNACZNIE zawiera informacje o pracownikach lub dokumentację dotyczącą ludzi\n" +
                          "- 'hardware' - TYLKO jeśli obraz JEDNOZNACZNIE zawiera informacje techniczne lub dokumentację dotyczącą maszyn\n" +
                          "- 'none' - jeśli masz JAKIEKOLWIEK wątpliwości lub obraz nie pasuje jednoznacznie do powyższych kategorii"
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/png;base64,${imageBuffer.toString('base64')}`,
                      detail: "high"
                    }
                  }
                ],
              },
            ],
            max_tokens: 50,
            temperature: 0.1
          });
          
          const result = response.choices[0]?.message?.content?.toLowerCase().trim() ?? null;
          console.log(`Wynik analizy obrazu ${filename}:`, result);
          return result === 'none' ? null : result;
        } catch (error) {
          console.error(`Błąd podczas analizy obrazu ${filename}:`, error);
          return null;
        }

      case '.mp3':
        console.log(`Transkrybuję plik audio ${filename}...`);
        const audioBuffer = await fs.readFile(filepath);
        const audioFile = new File([audioBuffer], filename, { type: 'audio/mpeg' });
        
        try {
          const transcription = await this.openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1"
          });
          console.log(`Plik audio ${filename} został pomyślnie transkrybowany`);
          return transcription.text;
        } catch (error) {
          console.error(`Błąd podczas transkrypcji audio ${filename}:`, error);
          return null;
        }

      default:
        return null;
    }
  }

  private async classifyContent(content: string): Promise<string | null> {
    if (!content) return null;
    
    // Jeśli content jest już sklasyfikowany (z analizy obrazu)
    if (content.toLowerCase().trim() === 'people' || content.toLowerCase().trim() === 'hardware') {
      return content.toLowerCase().trim();
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Jesteś ekspertem w klasyfikacji treści przemysłowej. Klasyfikuj treść TYLKO jeśli jesteś absolutnie pewien kategorii. W przypadku wątpliwości odpowiedz 'none'."
          },
          {
            role: "user",
            content: "Przeanalizuj tekst i odpowiedz TYLKO jednym słowem: 'people', 'hardware' lub 'none':\n" +
                     "- 'people' - TYLKO jeśli tekst JEDNOZNACZNIE dotyczy ludzi lub ich działań\n" +
                     "- 'hardware' - TYLKO jeśli tekst JEDNOZNACZNIE dotyczy maszyn i urządzeń\n" +
                     "- 'none' - jeśli masz JAKIEKOLWIEK wątpliwości lub tekst nie pasuje jednoznacznie do powyższych kategorii\n\n" +
                     "Tekst: " + content
          }
        ],
        temperature: 0.1,
        max_tokens: 50
      });

      const classification = response.choices[0]?.message?.content?.toLowerCase().trim() ?? null;
      console.log(`Wynik klasyfikacji: ${classification}`);
      return classification === 'none' ? null : (classification === 'people' || classification === 'hardware' ? classification : null);
    } catch (error) {
      console.error('Błąd podczas klasyfikacji treści:', error);
      return null;
    }
  }

  private async validateImageSize(buffer: Buffer): Promise<boolean> {
    const MAX_SIZE = 4 * 1024 * 1024; // 4MB
    return buffer.length <= MAX_SIZE;
  }
}

// Użycie
async function main() {
  const classifier = new FactoryClassifier();
  try {
    const result = await classifier.classifyFiles();
    console.log('Klasyfikacja zakończona:', result);
  } catch (error) {
    console.error('Błąd podczas klasyfikacji:', error);
  }
}

main(); 