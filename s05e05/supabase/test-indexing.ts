import { VectorizationService } from '../src/services/vectorization.service';
import { createEmbedding, supabase } from './client';
import { FileContent } from '../src/interfaces/file.interface';
import * as path from 'path';
import * as fs from 'fs/promises';

async function testIndexing() {
  try {
    console.log('Rozpoczynam test indeksowania...');
    const vectorizationService = new VectorizationService();
    vectorizationService.forceReprocess = true;

    // Wyczyść cache funkcji
    await supabase.rpc('reload_schema_cache');

    // Wyczyść bazę
    const { error: clearError1 } = await supabase
      .from('documents')
      .delete()
      .neq('id', 0);

    const { error: clearError2 } = await supabase
      .from('source_documents')
      .delete()
      .neq('id', 0);

    if (clearError1 || clearError2) {
      throw clearError1 || clearError2;
    }

    // Wczytaj wszystkie pliki z katalogu stories
    const storiesDir = path.join('data', 'stories');
    console.log('Szukam w katalogu:', storiesDir);
    const files = await fs.readdir(storiesDir);
    console.log('Znalezione pliki:', files);
    const storyFiles = files.filter(f => f.endsWith('.json'));
    console.log('Pliki JSON:', storyFiles);

    console.log(`\nZnaleziono ${storyFiles.length} plików do zaindeksowania.`);

    // Przetwórz każdy plik
    for (const storyFile of storyFiles) {
      const storyPath = path.join(storiesDir, storyFile);
      console.log(`\nPrzetwarzanie: ${storyFile}`);
      
      const content = await fs.readFile(storyPath, 'utf-8');
      const fileContent: FileContent = {
        path: storyPath,
        type: 'json',
        content
      };

      // Zapisz dokument źródłowy
      const { data: sourceDoc, error: sourceError } = await supabase
        .from('source_documents')
        .insert({
          title: path.basename(storyPath),
          file_path: storyPath,
          document_type: 'story',
          original_content: content,
          total_chunks: 0,
          metadata: { 
            type: 'conversation',
            version: '1.0'
          }
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Przetwórz plik
      const chunks = await vectorizationService.processFile(fileContent);
      console.log(`Wygenerowano ${chunks.length} chunków.`);
      console.log('Zawartość pierwszego chunka:', chunks[0]?.content);
      console.log('Metadane pierwszego chunka:', chunks[0]?.metadata);

      // Zapisz chunki
      for (const chunk of chunks) {
        const embedding = await createEmbedding(chunk.content);
        console.log('Długość wektora:', embedding.length);
        
        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            content: chunk.content,
            embedding: embedding,
            metadata: chunk.metadata,
            source_document_id: sourceDoc.id
          });

        if (insertError) {
          console.error('Błąd zapisu chunka:', insertError);
          throw insertError;
        }
      }

      // Zaktualizuj liczbę chunków
      await supabase
        .from('source_documents')
        .update({ total_chunks: chunks.length })
        .eq('id', sourceDoc.id);
    }

    // Test wyszukiwania
    console.log('\nTest wyszukiwania w zaindeksowanych historiach:');
    const testQueries = [
      "Kto wysłał wiadomość o podróży w czasie?",
      "Co się stało w roku 1999?",
      "Gdzie odbyło się spotkanie?",
      "Z kim rozmawiał Witek?"
    ];

    for (const query of testQueries) {
      console.log(`\nZapytanie: "${query}"`);
      const results = await vectorizationService.searchSimilarDocuments(query, 1);
      
      if (results.length > 0) {
        console.log(`Najlepsza odpowiedź (podobieństwo: ${results[0].similarity.toFixed(2)}):`);
        console.log(results[0].content);
      } else {
        console.log('Nie znaleziono odpowiedzi.');
      }
    }

    return true;
  } catch (error) {
    console.error('Błąd podczas testowania:', error);
    return false;
  }
}

// Uruchom test
testIndexing()
  .then(success => {
    console.log('\nTest zakończony:', success ? 'SUKCES' : 'BŁĄD');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Błąd krytyczny:', error);
    process.exit(1);
  }); 