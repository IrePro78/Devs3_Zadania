export type FileType = 'json' | 'markdown' | 'text' | 'audio' | 'image';

export interface FileContent {
  path: string;
  type: FileType;
  content: string;
  metadata?: Record<string, unknown>;
  binary?: Buffer;  // dla plików binarnych (audio, obrazy)
} 