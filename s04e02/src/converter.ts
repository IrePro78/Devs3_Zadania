import * as fs from 'node:fs';
import * as path from 'node:path';

interface FineTuneMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface FineTuneConversation {
    messages: FineTuneMessage[];
}

export class ConversationConverter {
    private sourcePath: string;
    private outputPath: string;

    constructor(sourcePath: string, outputPath: string) {
        this.sourcePath = sourcePath;
        this.outputPath = outputPath;
        console.log('🚀 Inicjalizacja konwertera konwersacji...');
    }

    async convertToJsonl(): Promise<void> {
        console.log(`\n📁 Skanowanie katalogu źródłowego: ${this.sourcePath}`);
        
        if (!fs.existsSync(this.sourcePath)) {
            throw new Error(`Katalog źródłowy nie istnieje: ${this.sourcePath}`);
        }

        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath, { recursive: true });
        }

        const files = fs.readdirSync(this.sourcePath)
            .filter(file => file.endsWith('.txt'));

        console.log(`📄 Znaleziono ${files.length} plików do konwersji`);

        const outputFilePath = path.join(this.outputPath, 'fine_tune_data.jsonl');
        const writeStream = fs.createWriteStream(outputFilePath);

        let totalLines = 0;

        for (const file of files) {
            console.log(`\n⚙️ Przetwarzanie pliku: ${file}`);
            const filePath = path.join(this.sourcePath, file);
            const fileName = path.parse(file).name;
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            
            // Dzielimy zawartość pliku na linie i usuwamy puste
            const lines = fileContent.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            for (const line of lines) {
                const conversation = {
                    messages: [
                        {
                            role: "system",
                            content: "validate numbers"
                        },
                        {
                            role: "user",
                            content: line
                        },
                        {
                            role: "assistant",
                            content: fileName
                        }
                    ]
                };

                writeStream.write(JSON.stringify(conversation) + '\n');
                totalLines++;
            }
        }

        writeStream.end();

        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', () => {
                console.log(`\n✨ Konwersja zakończona pomyślnie!`);
                console.log(`📝 Zapisano dane do: ${outputFilePath}`);
                console.log(`📊 Przekonwertowano ${totalLines} wierszy z ${files.length} plików`);
                resolve();
            });
            writeStream.on('error', reject);
        });
    }
} 