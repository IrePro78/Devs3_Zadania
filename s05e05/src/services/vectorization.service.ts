import { OpenAIService } from './openai.service';
import { FileContent, FileType } from '../interfaces/file.interface';
import { Chunk, ChunkMetadata } from '../interfaces/chunk.interface';
import { DocumentMetadata, BaseMetadata, EntityMetadata, TemporalMetadata } from '../interfaces/metadata.interface';
import { createEmbedding, supabase } from '../../supabase/client';
import * as path from 'path';
import { MediaService } from './media.service';

export class VectorizationService {
  private readonly MAX_CHUNK_SIZE = 1000;
  private openaiService: OpenAIService;
  public forceReprocess = false;

  constructor() {
    this.openaiService = new OpenAIService();
  }

  public async vectorizeFiles(files: FileContent[]): Promise<void> {
    console.log(`\nRozpoczynam wektoryzację ${files.length} plików...`);
    const mediaService = new MediaService();
    
    let skippedFiles = 0;
    let processedFiles = 0;
    let totalChunks = 0;

    // Najpierw sprawdź wszystkie istniejące pliki
    const { data: existingDocs } = await supabase
      .from('source_documents')
      .select('file_path, total_chunks')
      .in('file_path', files.map(f => f.path));

    // Utwórz mapę istniejących plików dla szybkiego dostępu
    const existingFilesMap = new Map(
      existingDocs?.map(doc => [doc.file_path, doc.total_chunks]) || []
    );

    for (const file of files) {
      try {
        console.log(`\nSprawdzam: ${file.path}`);

        // Sprawdź czy plik już istnieje w mapie
        if (existingFilesMap.has(file.path) && !this.forceReprocess) {
          const chunks = existingFilesMap.get(file.path);
          console.log(`✓ Plik ${file.path} już zaindeksowany (${chunks} chunków) - pomijam`);
          skippedFiles++;
          totalChunks += chunks || 0;
          continue;
        }

        // Jeśli plik istnieje i wymuszamy przetworzenie, usuń stare dane
        if (existingFilesMap.has(file.path) && this.forceReprocess) {
          console.log('Usuwam poprzednie dane...');
          await supabase
            .from('documents')
            .delete()
            .eq('source_document_id', existingFilesMap.get(file.path));
          
          await supabase
            .from('source_documents')
            .delete()
            .eq('file_path', file.path);
        }

        // Przygotuj treść do wektoryzacji
        let content = file.content;
        let mediaMetadata = {};

        if (file.type === 'audio' && file.binary) {
          content = await mediaService.transcribeAudio(file.binary, path.extname(file.path).slice(1));
          mediaMetadata = { media_type: 'audio', duration: 0 };
        } else if (file.type === 'image' && file.binary) {
          content = await mediaService.analyzeImage(file.binary);
          const dimensions = await mediaService.getImageMetadata(file.binary);
          mediaMetadata = { media_type: 'image', dimensions };
        }

        // Zapisz dokument źródłowy
        const { data: sourceDoc, error: sourceError } = await supabase
          .from('source_documents')
          .insert({
            title: path.basename(file.path),
            file_path: file.path,
            document_type: file.type,
            original_content: content,
            total_chunks: 0,
            metadata: { 
              type: file.type,
              version: '1.0',
              ...mediaMetadata
            }
          })
          .select()
          .single();

        if (sourceError) {
          console.error('Błąd zapisu dokumentu źródłowego:', sourceError);
          continue;
        }

        // Przetwórz plik na chunki
        const processedFile = { ...file, content };
        const chunks = await this.splitIntoChunks(file.content, file.type, file);
        const processedChunks = await Promise.all(chunks.map(chunk => this.processChunk(chunk)));
        console.log(`Wygenerowano ${processedChunks.length} chunków.`);

        // Zapisz chunki
        for (const chunk of processedChunks) {
          const { error: insertError } = await supabase
            .from('documents')
            .insert({
              content: chunk.content,
              embedding: chunk.embedding,
              metadata: {
                ...chunk.metadata,
                ...mediaMetadata
              },
              source_document_id: sourceDoc.id
            });

          if (insertError) {
            console.error('Błąd zapisu chunka:', insertError);
            continue;
          }
        }

        // Zaktualizuj liczbę chunków
        const { error: updateError } = await supabase
          .from('source_documents')
          .update({ total_chunks: processedChunks.length })
          .eq('id', sourceDoc.id);

        if (updateError) {
          console.error('Błąd aktualizacji liczby chunków:', updateError);
        }

        processedFiles++;
        totalChunks += processedChunks.length;

      } catch (error) {
        console.error(`Błąd podczas przetwarzania pliku ${file.path}:`, error);
      }
    }

    console.log('\n=== Podsumowanie wektoryzacji ===');
    console.log(`Pliki przetworzone: ${processedFiles}`);
    console.log(`Pliki pominięte: ${skippedFiles}`);
    console.log(`Łącznie chunków: ${totalChunks}`);
    console.log('================================\n');
  }

  private async splitIntoChunks(text: string, type: FileType, file: FileContent): Promise<Chunk[]> {
    switch (type) {
      case 'json': {
        const data = JSON.parse(text);
        const chunks: Chunk[] = [];

        for (const [convId, messages] of Object.entries(data)) {
          const messageArray = Array.isArray(messages) ? messages : [messages];
          const content = messageArray.join('\n');
          
          if (content.length > this.MAX_CHUNK_SIZE) {
            const conversationChunks = this.splitLongContent(content, {
              baseId: convId,
              type: 'conversation',
              preserveDialogues: true
            });
            chunks.push(...conversationChunks);
          } else {
            chunks.push(this.createChunk(content, {
              chunk_type: 'conversation' as const,
              document_type: 'story',
              conversation_id: convId
            }, file));
          }
        }
        return chunks;
      }

      case 'markdown': {
        const sections = text.split(/^#{1,6}\s+/m).filter(Boolean);
        return sections.map((section, index) => 
          this.createChunk(section, {
            chunk_type: 'section' as const,
            document_type: 'documentation'
          }, file)
        );
      }

      default:
        return [this.createChunk(text, {
          chunk_type: 'paragraph' as const,
          document_type: 'other'
        }, file)];
    }
  }

  private createChunk(content: string, options: {
    chunk_type: 'conversation' | 'section' | 'paragraph' | 'transcript' | 'description';
    document_type: string;
    conversation_id?: string;
  }, file: FileContent): Chunk {
    return {
      content,
      metadata: {
        filename: path.basename(file.path),
        created_at: new Date().toISOString(),
        chunk_type: options.chunk_type,
        document_type: options.document_type,
        language: this.detectLanguage(content),
        entities: this.extractEntities(content),
        temporal: this.extractTemporalReferences(content),
        topics: [this.detectTopic(content)],
        keywords: this.extractKeywords(content),
        sentiment: this.analyzeSentiment(content),
        confidential: this.hasConfidentialInfo(content),
        processing_status: 'processed',
        chunk_index: 0,
        total_chunks: 1,
        ...(options.conversation_id && {
          conversation: {
            conversation_id: options.conversation_id,
            message_index: 0,
            has_prev: false,
            has_next: false
          }
        })
      }
    };
  }

  private splitLongContent(content: string, options: {
    baseId: string;
    type: 'conversation' | 'section' | 'paragraph' | 'transcript' | 'description';
    preserveDialogues?: boolean;
  }): Chunk[] {
    const chunks = options.preserveDialogues
      ? content.split(/(?=^[A-ZŁÓŚĄŻŹĆĘŃ].*?:)/m).filter(Boolean)
      : content.match(/[^.!?]+[.!?]+/g) || [content];

    return chunks.map((chunk, index) => ({
      content: chunk.trim(),
      metadata: {
        chunk_type: options.type as 'conversation' | 'paragraph' | 'section' | 'transcript' | 'description',
        document_type: 'conversation',
        chunk_index: index,
        total_chunks: chunks.length,
        conversation: {
          conversation_id: options.baseId,
          message_index: index,
          has_prev: index > 0,
          has_next: index < chunks.length - 1
        }
      } as ChunkMetadata
    }));
  }

  private extractEntities(text: string): EntityMetadata {
    return {
      persons: text.match(/[A-ZŁÓŚĄŻŹĆĘŃ][a-złóśążźćęń]+/g) || [],
      locations: text.match(/w [A-ZŁÓŚĄŻŹĆĘŃ][a-złóśążźćęń]+/g)?.map(l => l.slice(2)) || [],
      dates: text.match(/\d{4}(-\d{2}(-\d{2})?)?/g) || [],
      events: []
    };
  }

  private extractTemporalReferences(text: string): TemporalMetadata {
    return {
      absolute_dates: text.match(/\d{4}(-\d{2}(-\d{2})?)?/g) || [],
      relative_dates: text.match(/wczoraj|dzisiaj|jutro|za tydzień|za miesiąc/g) || [],
      time_periods: text.match(/\d+ (dni|tygodni|miesięcy|lat)/g) || [],
      time_references: text.match(/(teraz|później|wcześniej|potem|przedtem)/g) || []
    };
  }

  private detectLanguage(text: string): 'pl' | 'en' {
    const polishChars = text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g)?.length || 0;
    return polishChars > 0 ? 'pl' : 'en';
  }

  private detectTopic(text: string): string {
    const topics = {
      computer: /komputer|program|system/i,
      business: /firma|praca|projekt/i,
      science: /badania|analiza|teoria/i
    };

    for (const [topic, pattern] of Object.entries(topics)) {
      if (pattern.test(text)) return topic;
    }
    return 'general';
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .match(/\b\w{4,}\b/g)
      ?.filter(word => !['tego', 'jest', 'oraz', 'były'].includes(word)) || [];
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positive = /(dobr|świetn|wspania|super|fantastycz)/i.test(text);
    const negative = /(zł|okropn|straszn|fatal)/i.test(text);
    return positive ? 'positive' : negative ? 'negative' : 'neutral';
  }

  private hasConfidentialInfo(text: string): boolean {
    return /(poufn|tajn|prywat|hasło|password)/i.test(text);
  }

  private async processChunk(chunk: Chunk): Promise<Chunk> {
    try {
      const metadata = chunk.metadata;
      metadata.word_count = chunk.content.split(/\s+/).length;
      metadata.processing_status = 'processed';
      metadata.last_modified = new Date().toISOString();

      // Generuj embedding
      const embedding = await createEmbedding(chunk.content);
      console.log('Otrzymany embedding w processChunk:', {
        type: typeof embedding,
        isArray: Array.isArray(embedding),
        length: embedding?.length,
        sample: embedding?.slice(0, 5)
      });

      // Sprawdź długość embeddingu
      if (!Array.isArray(embedding)) {
        throw new Error(`Embedding nie jest tablicą: ${typeof embedding}`);
      }

      if (embedding.length !== 3072) {
        throw new Error(`Nieprawidłowa długość embeddingu: ${embedding.length}`);
      }

      return {
        content: chunk.content,
        metadata,
        embedding
      };
    } catch (error) {
      console.error('Błąd podczas przetwarzania chunka:', error);
      throw error;
    }
  }
} 