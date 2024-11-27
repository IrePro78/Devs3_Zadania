import { OpenAI } from 'openai';
import { config } from 'dotenv';

config();

const TEST_DATA = [
    { id: "01", numbers: "12,100,3,39" },
    { id: "02", numbers: "-41,75,67,-25" },
    { id: "03", numbers: "78,38,65,2" },
    { id: "04", numbers: "5,64,67,30" },
    { id: "05", numbers: "33,-21,16,-72" },
    { id: "06", numbers: "99,17,69,61" },
    { id: "07", numbers: "17,-42,-65,-43" },
    { id: "08", numbers: "57,-83,-54,-43" },
    { id: "09", numbers: "67,-55,-6,-32" },
    { id: "10", numbers: "-20,-23,-2,44" }
];

async function verifyWithModel() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('Brak klucza API OpenAI');
    }

    const openai = new OpenAI({ apiKey });
    const correctIds: string[] = [];

    console.log('🔄 Weryfikacja danych z modelem...\n');

    for (const data of TEST_DATA) {
        try {
            const response = await openai.chat.completions.create({
                model: "ft:gpt-4o-mini-2024-07-18:personal:custom-analyzer:AYCFJrfU",
                messages: [
                    {
                        role: "system",
                        content: "validate numbers"
                    },
                    {
                        role: "user",
                        content: data.numbers
                    }
                ]
            });

            const result = response.choices[0].message.content;
            console.log(`ID: ${data.id}, Liczby: ${data.numbers}, Wynik: ${result}`);

            if (result === 'correct') {
                correctIds.push(data.id);
            }
        } catch (error) {
            console.error(`❌ Błąd dla ID ${data.id}:`, error);
        }
    }

    console.log('\n✨ Identyfikatory poprawnych rekordów:');
    console.log(JSON.stringify(correctIds));
    return correctIds;
}

verifyWithModel().catch(console.error); 