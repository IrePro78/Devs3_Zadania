import { readFile } from 'fs/promises';
import { join } from 'path';
import { supabase, createEmbedding } from './client';

interface DocumentMetadata {
  source: string;
  chunkIndex: number;
  totalChunks: number;
  section: string;
  type: 'narrative' | 'dialogue' | 'event' | 'location' | 'date';
  characters?: string[];
  locations?: string[];
  dates?: string[];
  events?: string[];
  context?: string;
}

async function extractMetadata(content: string): Promise<Partial<DocumentMetadata>> {
  const metadata: Partial<DocumentMetadata> = {};
  
  // Wykryj daty
  const dateMatches = content.match(/\d{4}[-/]\d{2}[-/]\d{2}|\d{4}/g);
  if (dateMatches) metadata.dates = dateMatches;

  // Wykryj postacie (Rafał, Andrzej)
  const characterMatches = content.match(/\b(Rafał|Andrzej)\b/g);
  if (characterMatches) metadata.characters = [...new Set(characterMatches)];

  // Wykryj typ zawartości
  if (content.includes('spotkanie')) metadata.type = 'event';
  else if (content.includes('powiedział')) metadata.type = 'dialogue';
  else if (content.match(/\d{4}[-/]\d{2}[-/]\d{2}/)) metadata.type = 'date';
  else metadata.type = 'narrative';

  return metadata;
}

async function seedFromMarkdown() {
  try {
    console.log('Rozpoczynam indeksowanie pliku Markdown...');

    // Wczytaj plik MD
    const mdPath = join(process.cwd(), 'notatnik-rafala.md');
    const content = await readFile(mdPath, 'utf-8');

    // Dodaj dokument źródłowy
    const { data: sourceDoc, error: sourceError } = await supabase
      .from('source_documents')
      .insert({
        title: 'Notatnik Rafała',
        file_path: mdPath,
        total_chunks: 0
      })
      .select()
      .single();

    if (sourceError) throw sourceError;

    // Podziel na sekcje (po nagłówkach)
    const sections = content.split(/(?=^#{1,2}\s)/m)
      .filter(section => section.trim().length > 0);

    const chunks: { content: string; metadata: DocumentMetadata }[] = [];
    let globalChunkIndex = 0;

    for (const section of sections) {
      // Wyodrębnij tytuł sekcji
      const titleMatch = section.match(/^(#{1,2})\s+(.+)$/m);
      const isMainSection = titleMatch?.[1].length === 1;
      const title = titleMatch?.[2] || 'Bez tytułu';

      // Znajdź obrazy w tej sekcji
      const imageRegex = /!\[.*?\]\((.*?)\)/g;
      const sectionImages: string[] = [];
      let match;
      while ((match = imageRegex.exec(section)) !== null) {
        sectionImages.push(match[1]);
        await supabase.from('document_images').insert({
          file_path: match[1],
          source_document_id: sourceDoc.id
        });
      }

      // Podziel sekcję na paragrafy
      const paragraphs = section
        .split(/\n\n+/)
        .filter(p => p.trim().length > 0 && !p.trim().startsWith('#'));

      // Dodaj każdy paragraf jako osobny chunk
      for (const paragraph of paragraphs) {
        const cleanContent = paragraph.replace(/!\[.*?\]\([^)]+\)/g, '').trim();
        if (cleanContent.length > 0) {
          chunks.push({
            content: cleanContent,
            metadata: {
              source: 'notatnik-rafala',
              chunkIndex: globalChunkIndex++,
              totalChunks: 0,
              section: isMainSection ? title : `Podsekcja: ${title}`,
              type: 'narrative',
              ...await extractMetadata(cleanContent)
            }
          });
        }
      }
    }

    // Zaktualizuj totalChunks
    const totalChunks = chunks.length;
    await supabase
      .from('source_documents')
      .update({ total_chunks: totalChunks })
      .eq('id', sourceDoc.id);

    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = totalChunks;
    });

    // Dodaj chunki do bazy
    console.log(`\nDodawanie ${chunks.length} fragmentów...`);
    
    for (const [index, chunk] of chunks.entries()) {
      console.log(`\nPrzetwarzanie fragmentu ${index + 1}/${chunks.length}`);
      console.log(`Sekcja: ${chunk.metadata.section}`);
      
      const embedding = await createEmbedding(chunk.content);
      
      const { error } = await supabase.from('documents').insert({
        content: chunk.content,
        embedding,
        metadata: chunk.metadata,
        source_document_id: sourceDoc.id
      });

      if (error) throw error;
    }

    console.log('\n✓ Indeksowanie zakończone pomyślnie');
    return true;
  } catch (error) {
    console.error('Błąd podczas indeksowania:', error);
    return false;
  }
}

seedFromMarkdown()
  .then(success => process.exit(success ? 0 : 1))
  .catch(() => process.exit(1)); 