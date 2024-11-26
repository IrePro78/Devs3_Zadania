import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function setup() {
  try {
    // 1. Tworzenie katalogów
    console.log('Tworzenie katalogów...');
    const directories = ['source_audio', 'transkrypcja_audio'];
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // 2. Tworzenie package.json
    console.log('Tworzenie package.json...');
    const packageJson = {
      "name": "audio-transcription",
      "version": "1.0.0",
      "description": "Transkrypcja plików audio",
      "main": "transcribe.ts",
      "scripts": {
        "start": "ts-node transcribe.ts",
        "build": "tsc",
        "dev": "nodemon --exec ts-node transcribe.ts"
      },
      "dependencies": {
        "dotenv": "16.4.1"
      },
      "devDependencies": {
        "@types/node": "20.11.0",
        "typescript": "5.3.3",
        "ts-node": "10.9.2",
        "nodemon": "3.0.3"
      }
    };
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

    // 3. Tworzenie tsconfig.json
    console.log('Tworzenie tsconfig.json...');
    const tsconfigJson = {
      "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "outDir": "./dist",
        "moduleResolution": "node",
        "resolveJsonModule": true
      },
      "include": ["./**/*"],
      "exclude": ["node_modules", "dist"]
    };
    fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfigJson, null, 2));

    // 4. Tworzenie pliku .env
    console.log('Tworzenie pliku .env...');
    const envContent = 'GROQ_API_KEY=twój-klucz-api-groq\n';
    fs.writeFileSync('.env', envContent);

    // 5. Instalacja zależności
    console.log('Instalacja zależności npm...');
    await execAsync('npm install');

    console.log('\nInstalacja zakończona pomyślnie!');
    console.log('\nAby uruchomić skrypt:');
    console.log('1. Umieść pliki .m4a w katalogu source_audio');
    console.log('2. Ustaw GROQ_API_KEY w pliku .env');
    console.log('3. Uruchom: npm start');

  } catch (error) {
    console.error('Wystąpił błąd podczas instalacji:', error);
  }
}

setup(); 