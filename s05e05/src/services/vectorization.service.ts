import { createEmbedding, supabase } from '../../supabase/client';
import { FileContent, FileType } from '../interfaces/file.interface';
import { DocumentMetadata, BaseMetadata } from '../interfaces/metadata.interface';
import * as path from 'path';
import { Chunk, ChunkMetadata } from '../interfaces/chunk.interface';
import { MediaService } from '../services/media.service';
import { OpenAIService } from './openai.service';

export class VectorizationService {
  private readonly CHUNK_SIZE = 1000;
  private mediaService: MediaService;
  private openaiService: OpenAIService;

  constructor() {
    this.mediaService = new MediaService();
    this.openaiService = new OpenAIService();
  }

  private async isFileAlreadyProcessed(filePath: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('source_documents')
      .select('id')
      .eq('file_path', filePath)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  }

  public async vectorizeFiles(files: FileContent[]): Promise<void> {
    for (const file of files) {
      try {
        console.log(`\nPrzetwarzanie pliku: ${file.path}`);

        if (await this.isFileAlreadyProcessed(file.path)) {
          console.log(`✓ Plik ${file.path} został już przetworzony, pomijam`);
          continue;
        }

        // Dodaj dokument źródłowy z oryginalną treścią
        const { data: sourceDoc, error: sourceError } = await supabase
          .from('source_documents')
          .insert({
            title: path.basename(file.path),
            file_path: file.path,
            document_type: file.type,
            original_content: file.content,
            total_chunks: 0,
            metadata: this.getMetadataForType(file)
          })
          .select()
          .single();

        if (sourceError) throw sourceError;

        // Podziel treść na fragmenty
        const chunks = await this.splitIntoChunks(file.content, file.type, file);
        
        // Zaktualizuj liczbę fragmentów
        await supabase
          .from('source_documents')
          .update({ total_chunks: chunks.length })
          .eq('id', sourceDoc.id);

        // Przetwórz każdy fragment
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await createEmbedding(chunk.content);

          const { error: insertError } = await supabase
            .from('documents')
            .insert({
              content: chunk.content,
              embedding,
              metadata: {
                ...chunk.metadata,
                ...this.getChunkMetadata(file, i)
              },
              source_document_id: sourceDoc.id
            });

          if (insertError) throw insertError;
          
          console.log(`✓ Zapisano fragment ${i + 1}/${chunks.length}`);
        }

      } catch (error) {
        console.error(`Błąd podczas wektoryzacji pliku ${file.path}:`, error);
        throw error;
      }
    }
  }

  private getMetadataForType(file: FileContent): DocumentMetadata {
    const baseMetadata: BaseMetadata = {
      filename: path.basename(file.path),
      created_at: new Date().toISOString(),
      chunk_index: 0,
      total_chunks: 0,
      language: this.detectLanguage(file.content),
      document_type: this.detectDocumentType(file)
    };

    try {
      switch (file.type) {
        case 'json':
          const data = JSON.parse(file.content);
          const names = this.extractNames(data);
          const { dates, locations } = this.extractEntities(data);
          
          return {
            ...baseMetadata,
            participants: names,
            locations,
            dates,
            sentiment: this.analyzeSentiment(data),
            confidential: this.hasConfidentialInfo(data)
          };

        default:
          return baseMetadata;
      }
    } catch (error) {
      console.error(`Błąd podczas analizy metadanych w pliku ${file.path}:`, error);
      return baseMetadata;
    }
  }

  private getChunkMetadata(file: FileContent, chunkIndex: number): Record<string, unknown> {
    try {
      switch (file.type) {
        case 'json':
          const data = JSON.parse(file.content);
          const conversationId = Object.keys(data)[Math.floor(chunkIndex / data[Object.keys(data)[0]].length)];
          return {
            conversation_id: conversationId,
            ...file.metadata
          };
        default:
          return file.metadata || {};
      }
    } catch (error) {
      console.error(`Błąd parsowania JSON w pliku ${file.path}:`, error);
      return file.metadata || {};
    }
  }

  private splitLongContent(
    content: string, 
    baseId: string,
    baseMetadata: ChunkMetadata
  ): Chunk[] {
    const chunks: string[] = [];
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    
    let currentChunk = '';
    
    // Podziel na chunki
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.CHUNK_SIZE && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    // Utwórz chunki z referencjami
    return chunks.map((chunkContent, index) => {
      const partId = `${baseId}_part${index}`;
      
      return {
        content: chunkContent,
        metadata: {
          ...baseMetadata,
          original_text_id: baseId,
          part_index: index,
          total_parts: chunks.length,
          prev_part_id: index > 0 ? `${baseId}_part${index-1}` : undefined,
          next_part_id: index < chunks.length - 1 ? `${baseId}_part${index+1}` : undefined
        }
      };
    });
  }

  private async splitIntoChunks(text: string, type: FileType, file: FileContent): Promise<Chunk[]> {
    switch (type) {
      case 'audio':
        return this.processAudioFile(file);
      case 'image':
        return this.processImageFile(file);
      case 'json':
        // ... istniejący kod ...
      case 'markdown':
        // ... istniejący kod ...
      default:
        return this.splitLongContent(text, path.basename(file.path), {
          filename: path.basename(file.path),
          created_at: new Date().toISOString(),
          chunk_index: 0,
          total_chunks: 1,
          language: this.detectLanguage(text),
          topic: this.detectTopic(text),
          keywords: this.extractKeywords(text)
        });
    }
  }

  private detectTopic(text: string): string {
    // Prosta implementacja - można rozszerzyć używając NLP lub LLM
    const topics = {
      computer: /komputer|program|system/i,
      business: /firma|praca|projekt/i,
      science: /badania|analiza|teoria/i,
      general: /.*/ // domyślny temat
    };

    for (const [topic, pattern] of Object.entries(topics)) {
      if (pattern.test(text)) return topic;
    }

    return 'general';
  }

  private extractKeywords(text: string): string[] {
    // Prosta implementacja - można rozszerzyć używając NLP
    const words = text.toLowerCase()
      .replace(/[.,!?]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4);  // tylko dłuższe słowa

    return [...new Set(words)].slice(0, 5);  // top 5 unikalnych słów
  }

  private detectLanguage(text: string): 'pl' | 'en' {
    const polishChars = text.match(/[ąćęłńóśźż]/gi)?.length || 0;
    return polishChars > 5 ? 'pl' : 'en';
  }

  private extractNames(data: Record<string, string[]>): string[] {
    const namePattern = /(?:^|\s)(?:Andrzej|Samuel|Tomasz|Zygfryd|Witek)(?:\s|$)/g;
    const allText = Object.values(data).flat().join(' ');
    return [...new Set(allText.match(namePattern) || [])].map(n => n.trim());
  }

  private extractEntities(data: Record<string, string[]>): { dates: string[], locations: string[] } {
    const allText = Object.values(data).flat().join(' ');
    const dates = allText.match(/\d{4}(?:-\d{2}-\d{2})?/g) || [];
    const locations = allText.match(/(?:w |do )([\w\s]+)(?=[\.,])/g)?.map(l => l.replace(/^w |do /, '')) || [];
    return { dates, locations };
  }

  private analyzeSentiment(data: Record<string, string[]>): 'positive' | 'negative' | 'neutral' {
    const allText = Object.values(data).flat().join(' ');
    if (allText.match(/błąd|problem|kiepski|trudno/g)) return 'negative';
    if (allText.match(/świetnie|super|dobrze/g)) return 'positive';
    return 'neutral';
  }

  private hasConfidentialInfo(data: Record<string, string[]>): boolean {
    const allText = Object.values(data).flat().join(' ');
    return allText.includes('hasło') || allText.includes('tajne') || allText.includes('poufne');
  }

  private detectDocumentType(file: FileContent): string {
    switch (file.type) {
      case 'json':
        return 'conversation';
      case 'markdown':
        return 'scientific';
      case 'text':
        return 'text';
      default:
        return 'other';
    }
  }

  private async processAudioFile(file: FileContent): Promise<Chunk[]> {
    const transcript = await this.openaiService.transcribeAudio(file.path);
    
    const baseMetadata: ChunkMetadata = {
      filename: path.basename(file.path),
      created_at: new Date().toISOString(),
      media_type: 'audio',
      format: path.extname(file.path).substring(1),
      language: this.detectLanguage(transcript),
      topic: this.detectTopic(transcript),
      keywords: this.extractKeywords(transcript),
      chunk_index: 0,
      total_chunks: 1
    };

    // Podziel transkrypcję na fragmenty jeśli jest długa
    if (transcript.length > this.CHUNK_SIZE) {
      return this.splitLongContent(
        transcript,
        `audio_${path.basename(file.path)}`,
        baseMetadata
      );
    }

    return [{
      content: transcript,
      metadata: baseMetadata
    }];
  }

  private async processImageFile(file: FileContent): Promise<Chunk[]> {
    if (!file.binary) {
      throw new Error('Brak danych binarnych dla pliku obrazu');
    }

    // Uzyskaj opis obrazu
    const description = await this.openaiService.describeImage(file.binary);

    const baseMetadata: ChunkMetadata = {
      filename: path.basename(file.path),
      created_at: new Date().toISOString(),
      media_type: 'image',
      format: path.extname(file.path).substring(1),
      topic: this.detectTopic(description),
      keywords: this.extractKeywords(description),
      chunk_index: 0,
      total_chunks: 1,
      language: this.detectLanguage(description)
    };

    return [{
      content: description,
      metadata: baseMetadata
    }];
  }
} 