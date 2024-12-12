import { supabase } from './client';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileContent } from '../src/interfaces/file.interface';
import { VectorizationService } from '../src/services/vectorization.service';

async function loadTestFiles(): Promise<FileContent[]> {
  const files: FileContent[] = [];
  const baseDir = 'data/stories';

  // Rekurencyjnie przeszukaj wszystkie katalogi
  async function processDirectory(dirPath: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        let type: 'json' | 'markdown' | 'text' | 'audio' | 'image';

        // Określ typ pliku na podstawie rozszerzenia
        switch (ext) {
          case '.json':
            type = 'json';
            break;
          case '.md':
            type = 'markdown';
            break;
          case '.mp3':
          case '.m4a':
            type = 'audio';
            break;
          case '.png':
          case '.jpg':
          case '.jpeg':
            type = 'image';
            break;
          default:
            type = 'text';
        }

        // Wczytaj plik jako tekst lub binary w zależności od typu
        if (type === 'audio' || type === 'image') {
          const binary = await fs.readFile(fullPath);
          files.push({
            path: fullPath,
            type,
            content: '',
            binary
          });
        } else {
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({
            path: fullPath,
            type,
            content
          });
        }
      }
    }
  }

  await processDirectory(baseDir);
  return files;
}

async function main() {
  try {
    console.log('Rozpoczynam ładowanie plików...');
    const files = await loadTestFiles();
    console.log(`Załadowano ${files.length} plików`);

    // Wyświetl statystyki plików
    const stats = files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nTypy znalezionych plików:');
    Object.entries(stats).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });

    console.log('\nRozpoczynam wektoryzację...');
    const vectorizationService = new VectorizationService();
    await vectorizationService.vectorizeFiles(files);

    console.log('\n✓ Zakończono wektoryzację plików');
  } catch (error) {
    console.error('Błąd podczas seedowania danych:', error);
    process.exit(1);
  }
}

main(); 