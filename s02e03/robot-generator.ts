import * as fs from 'fs';
import { Configuration, OpenAIApi } from 'openai';
import * as dotenv from 'dotenv';

// Załaduj zmienne środowiskowe
dotenv.config();

async function generatePromptWithGPT4(description: string): Promise<string> {
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "Jesteś ekspertem w tworzeniu promptów dla DALL-E. Twoim zadaniem jest przekształcenie opisu robota na krótki, precyzyjny prompt w języku angielskim, który pozwoli DALL-E wygenerować dokładny obraz."
                },
                {
                    role: "user",
                    content: `Przekształć poniższy opis na prompt dla DALL-E. Skup się na wizualnych aspektach robota:\n${description}`
                }
            ],
        });

        const prompt = completion.data.choices[0]?.message?.content;
        if (!prompt) throw new Error('Nie udało się wygenerować promptu');
        
        console.log('\nWygenerowany prompt:', prompt);
        return prompt;
    } catch (error) {
        console.error('Błąd podczas generowania promptu:', error);
        throw error;
    }
}

async function generateRobotImage() {
    try {
        // Odczytaj opis z pliku tekstowego
        const description: string = fs.readFileSync('pl.txt', 'utf8');
        console.log('Odczytany opis:', description);

        // Wygeneruj prompt używając GPT-4
        const generatedPrompt = await generatePromptWithGPT4(description);

        // Konfiguracja klienta OpenAI
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);

        // Generowanie obrazu używając DALL-E 2
        const response = await openai.createImage({
            prompt: generatedPrompt,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json',
        });

        // Zapisywanie obrazu
        const imageData = response.data.data[0].b64_json;
        if (!imageData) {
            throw new Error('Nie otrzymano danych obrazu');
        }
        const buffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync('robot.png', buffer);
        
        console.log('Obraz został pomyślnie wygenerowany i zapisany jako robot.png');
    } catch (error) {
        console.error('Wystąpił błąd:', error);
    }
}

generateRobotImage(); 