import * as fs from 'fs/promises';
import * as path from 'path';
import { FileContent } from '../interfaces/file.interface';

export class FileReaderService {
  private readonly STORIES_DIR = 'data/stories';

  public async readFiles(): Promise<FileContent[]> {
    try {
      const files = await fs.readdir(this.STORIES_DIR);
      const contents: FileContent[] = [];

      for (const file of files) {
        const filePath = path.join(this.STORIES_DIR, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const content = await fs.readFile(filePath, 'utf-8');
          const type = path.extname(file).slice(1) as FileContent['type'];

          contents.push({
            path: filePath,
            type,
            content: content.trim(),
            metadata: {
              filename: file,
              created_at: new Date().toISOString()
            }
          });
        }
      }

      return contents;
    } catch (error) {
      console.error('Błąd podczas odczytu plików:', error);
      throw error;
    }
  }
} 