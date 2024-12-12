import * as fs from 'fs/promises';
import * as path from 'path';
import { FileContent, FileType } from './interfaces/file.interface';
import { config } from 'dotenv';
import { VectorizationService } from './services/vectorization.service';

async function loadFile(filePath: string): Promise<FileContent> {
  const ext = path.extname(filePath).toLowerCase();
  const type = getFileType(ext);
  
  // Dla plików binarnych
  if (type === 'audio' || type === 'image') {
    const binary = await fs.readFile(filePath);
    return {
      path: filePath,
      type,
      content: '', // Puste dla plików binarnych
      binary
    };
  }
  
  // Dla plików tekstowych
  const content = await fs.readFile(filePath, 'utf-8');
  return {
    path: filePath,
    type,
    content
  };
}

function getFileType(ext: string): FileType {
  switch (ext) {
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    case '.mp3':
    case '.m4a':
    case '.wav':
      return 'audio';
    case '.png':
    case '.jpg':
    case '.jpeg':
      return 'image';
    default:
      return 'text';
  }
}

async function processDirectory(dirPath: string): Promise<FileContent[]> {
  const files = await fs.readdir(dirPath, { withFileTypes: true });
  const results: FileContent[] = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    
    if (file.isDirectory()) {
      const subDirFiles = await processDirectory(fullPath);
      results.push(...subDirFiles);
    } else {
      try {
        const fileContent = await loadFile(fullPath);
        results.push(fileContent);
      } catch (error) {
        console.error(`Błąd wczytywania pliku ${fullPath}:`, error);
      }
    }
  }

  return results;
}

async function main(): Promise<void> {
  config();

  try {
    const files = await processDirectory('./data/stories');
    const vectorizationService = new VectorizationService();
    await vectorizationService.vectorizeFiles(files);
  } catch (error) {
    console.error('Błąd podczas przetwarzania:', error);
  }
}

main(); 