import OpenAI from 'openai';
import * as fs from 'fs/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { File } from 'buffer';

dotenv.config();

class ContentAnalyzer {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Brak klucza API OpenAI w zmiennych środowiskowych!');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  private getFullUrl(relativePath: string, baseUrl: string): string {
    if (relativePath.startsWith('http')) {
      return relativePath;
    }
    // Usuń początkowy slash jeśli istnieje
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

    console.log('Full URL:', `${baseUrl}/${cleanPath}`);
    return `${baseUrl}/dane/${cleanPath}`;
  }

  async indexPage(url: string): Promise<void> {
    try {
      console.log('Pobieram stronę:', url);
      const response = await axios.get(url);
      const baseUrl = new URL(url).origin;
      console.log('Base URL:', baseUrl);
      
      const $ = cheerio.load(response.data);

      // Znajdź wszystkie obrazy i wyświetl ich URL-e
      const images = $('img').map((_, img) => {
        const src = $(img).attr('src');
        const fullUrl = this.getFullUrl(src || '', baseUrl);
        console.log('Znaleziony obraz:', fullUrl);
        return fullUrl;
      }).get();

      let content = '';
      let imageIndex = 0;

      for (const element of $('body *')) {
        const $elem = $(element);
        const tagName = element.tagName?.toLowerCase();

        // Obsługa tekstu
        if (tagName === 'p' || tagName?.startsWith('h')) {
          const text = $elem.text().trim();
          if (text) {
            if (tagName?.startsWith('h')) {
              const level = tagName.charAt(1);
              content += `\n${'#'.repeat(Number(level))} ${text}\n\n`;
            } else {
              content += `${text}\n\n`;
            }
          }
        }

        // Obsługa obrazów
        if (tagName === 'img') {
          const imgSrc = $elem.attr('src');
          if (imgSrc) {
            const fullImageUrl = this.getFullUrl(imgSrc, baseUrl);
            console.log(`\nPrzetwarzanie obrazu ${imageIndex + 1}/${images.length}: ${fullImageUrl}`);

            try {
              // Pobierz obraz
              const imageResponse = await axios.get(fullImageUrl, {
                responseType: 'arraybuffer'
              });
              console.log('Obraz pobrany, konwertuję na base64...');

              // Konwertuj na base64
              const base64Image = Buffer.from(imageResponse.data).toString('base64');
              console.log('Rozpoczynam analizę obrazu...');

              // Analizuj obraz
              const visionResponse = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "user",
                    content: [
                      { 
                        type: "text", 
                        text: "Opisz szczegółowo co widzisz na tym obrazie." 
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:image/jpeg;base64,${base64Image}`
                        }
                      }
                    ]
                  }
                ],
                max_tokens: 500
              });

              const imageDescription = visionResponse.choices[0]?.message?.content;
              console.log('Analiza obrazu zakończona:', imageDescription);

              content += `\n### [OBRAZ ${imageIndex + 1}]:\n${imageDescription}\n\n`;
              imageIndex++;
            } catch (error) {
              console.error('Błąd podczas przetwarzania obrazu:', error);
              content += `\n### [OBRAZ ${imageIndex + 1}]: Nie udało się przeanalizować obrazu\n\n`;
              imageIndex++;
            }
          }
        }

        // Obsługa audio
        if (tagName === 'audio') {
          const audioSrc = $elem.find('source').attr('src');
          if (audioSrc) {
            const fullAudioUrl = this.getFullUrl(audioSrc, baseUrl);
            console.log(`\nPrzetwarzanie audio: ${fullAudioUrl}`);
            
            try {
              const audioResponse = await axios.get(fullAudioUrl, { 
                responseType: 'arraybuffer' 
              });
              const audioBuffer = Buffer.from(audioResponse.data);
              const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

              const transcription = await this.openai.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-1"
              });

              content += `\n### [AUDIO]:\n${transcription.text}\n\n`;
            } catch (error) {
              console.error('Błąd podczas transkrypcji audio:', error);
              content += '\n### [AUDIO]: Nie udało się przetworzyć pliku audio\n\n';
            }
          }
        }
      }

      console.log('\nZapisuję wyniki do pliku...');
      await fs.writeFile('arxiv-draft.md', content);
      console.log('Plik arxiv-draft.md został zapisany');

    } catch (error) {
      console.error('Wystąpił błąd:', error);
      throw error;
    }
  }
}

async function main() {
  const analyzer = new ContentAnalyzer();
  try {
    await analyzer.indexPage('https://centrala.ag3nts.org/dane/arxiv-draft.html');
  } catch (error) {
    console.error('Błąd:', error);
  }
}

main(); 