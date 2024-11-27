import { OpenAI } from 'openai';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as readline from 'readline';
import * as os from 'os';
import * as fs from 'fs';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const isWindows = os.platform() === 'win32';

// Definicje dostępnych funkcji systemowych
const systemCommands = {
    openNotepad: () => 'notepad',
    openCalculator: () => 'calc',
    openBrowser: (url?: string) => url ? `start chrome ${url}` : 'start chrome',
    openMail: () => 'start outlook',
    openFileExplorer: () => 'explorer',
    openPaint: () => 'mspaint'
} as const;

// Funkcja do mówienia używająca OpenAI TTS
async function speak(text: string): Promise<void> {
    try {
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: text,
        });

        // Tworzymy unikalną nazwę pliku w katalogu temp
        const tempDir = os.tmpdir();
        const tempFile = `${tempDir}\\speech_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
        
        try {
            await fs.promises.writeFile(tempFile, Buffer.from(await mp3.arrayBuffer()));
            
            const psCommand = `
                $player = New-Object System.Windows.Media.MediaPlayer;
                $player.Open('${tempFile.replace(/\\/g, '\\\\')}');
                $player.Play();
                Start-Sleep -Seconds 2;
                $player.Stop();
                $player.Close();
                Remove-Item '${tempFile.replace(/\\/g, '\\\\')}' -Force;
            `;
            
            await new Promise<void>((resolve) => {
                exec(`powershell -Command "${psCommand}"`, (error) => {
                    if (error) {
                        console.error('Błąd podczas odtwarzania:', error);
                    }
                    resolve();
                });
            });
        } catch (err) {
            console.error('Błąd podczas operacji na pliku:', err);
        }
    } catch (error) {
        console.error('Błąd podczas generowania mowy:', error);
    }
}

async function interpretCommand(userInput: string): Promise<string> {
    const completion = await openai.chat.completions.create({
        messages: [
            {
                role: "system",
                content: `Jesteś asystentem Windows 11, który pomaga uruchamiać aplikacje systemowe.
                Gdy użytkownik chce:
                - pisać/notować -> wybierz 'notepad'
                - liczyć/kalkulować -> wybierz 'calculator'
                - przeglądać internet -> wybierz 'browser'
                - sprawdzić pocztę/wysłać mail -> wybierz 'mail'
                - przeglądać pliki -> wybierz 'explorer'
                - rysować/malować -> wybierz 'paint'
                
                NIE twórz plików ani nie wykonuj poleceń Unix/Linux.
                Twoim zadaniem jest TYLKO uruchamianie odpowiednich aplikacji Windows.`
            },
            {
                role: "user",
                content: userInput
            }
        ],
        model: "gpt-3.5-turbo",
        tools: [{
            type: "function",
            function: {
                name: 'executeSystemCommand',
                description: 'Uruchamia odpowiednią aplikację Windows na podstawie intencji użytkownika',
                parameters: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['notepad', 'calculator', 'browser', 'mail', 'explorer', 'paint'],
                            description: 'Typ aplikacji do uruchomienia'
                        },
                        url: {
                            type: 'string',
                            description: 'URL strony do otwarcia w przeglądarce (opcjonalne)'
                        }
                    },
                    required: ['action']
                }
            }
        }],
        tool_choice: { type: "function", function: { name: "executeSystemCommand" } }
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    
    if (toolCall && toolCall.type === 'function' && toolCall.function.name === 'executeSystemCommand') {
        const args = JSON.parse(toolCall.function.arguments);
        
        switch (args.action) {
            case 'notepad':
                return systemCommands.openNotepad();
            case 'calculator':
                return systemCommands.openCalculator();
            case 'browser':
                return systemCommands.openBrowser(args.url);
            case 'mail':
                return systemCommands.openMail();
            case 'explorer':
                return systemCommands.openFileExplorer();
            case 'paint':
                return systemCommands.openPaint();
            default:
                throw new Error('Nieznana akcja');
        }
    }

    throw new Error('Nie udało się zinterpretować polecenia');
}

async function executeCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(command, async (error, stdout, stderr) => {
            if (error) {
                const errorMessage = `Wystąpił błąd podczas wykonywania polecenia`;
                console.error(chalk.red(errorMessage));
                await speak(errorMessage);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(chalk.yellow(`Ostrzeżenie: ${stderr}`));
            }
            if (stdout) {
                console.log(chalk.green(`Wynik: ${stdout}`));
            }
            resolve();
        });
    });
}

async function startCommandLoop() {
    const welcomeMessage = 'Witaj! Jestem twoim asystentem. Powiedz mi, co chcesz zrobić.';
    console.log(chalk.blue(welcomeMessage));
    await speak(welcomeMessage);
    
    console.log(chalk.blue('Wpisz "exit" aby zakończyć program.'));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askCommand = () => {
        rl.question(chalk.yellow('\nCo chcesz zrobić?: '), async (input: string) => {
            if (input.toLowerCase() === 'exit') {
                const goodbyeMessage = 'Do widzenia! Miłego dnia!';
                console.log(chalk.blue(goodbyeMessage));
                await speak(goodbyeMessage);
                rl.close();
                return;
            }

            try {
                // Cicho interpretujemy polecenie
                const systemCommand = await interpretCommand(input);
                
                // Określamy nazwę aplikacji
                const appName = getApplicationName(systemCommand);
                const executingMessage = `Uruchamiam dla Ciebie ${appName}`;
                
                // TYLKO ten jeden komunikat głosowy
                console.log(chalk.cyan(executingMessage));
                await speak(executingMessage);

                // Wykonujemy polecenie
                await executeCommand(systemCommand);
            } catch (error) {
                const errorMessage = `Przepraszam, ale nie mogę wykonać tego polecenia`;
                console.error(chalk.red(errorMessage));
                await speak(errorMessage);
            }

            askCommand();
        });
    };

    askCommand();
}

// Poprawiona funkcja getApplicationName dla lepszych komunikatów
function getApplicationName(command: string): string {
    switch (command) {
        case 'notepad':
            return 'notatnik';
        case 'calc':
            return 'kalkulator';
        case 'start chrome':
            return 'przeglądarkę internetową';
        case 'start outlook':
            return 'program pocztowy';
        case 'explorer':
            return 'eksplorator plików';
        case 'mspaint':
            return 'program Paint';
        default:
            if (command.startsWith('start chrome http')) {
                const url = command.split(' ')[2];
                return `przeglądarkę ze stroną ${url}`;
            }
            return command;
    }
}

startCommandLoop(); 