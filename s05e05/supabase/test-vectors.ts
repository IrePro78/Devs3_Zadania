import { VectorizationService } from '../src/services/vectorization.service';
import { createEmbedding, supabase } from './client';
import { FileContent } from '../src/interfaces/file.interface';
import * as path from 'path';

async function testVectors() {
  try {
    console.log('Rozpoczynam test wektorów...');
    const vectorizationService = new VectorizationService();

    // Wyczyść cache funkcji
    await supabase.rpc('reload_schema_cache');

    // Na początku testu
    const { error: clearError1 } = await supabase
      .from('documents')
      .delete()
      .neq('id', 0); // Usuń wszystkie dokumenty

    const { error: clearError2 } = await supabase
      .from('source_documents')
      .delete()
      .neq('id', 0); // Usuń wszystkie dokumenty źródłowe

    if (clearError1 || clearError2) {
      throw clearError1 || clearError2;
    }

    // Test 1: Plik JSON z dialogami
    console.log('\n=== Test 1: Plik JSON z dialogami ===');
    const jsonContent: FileContent = {
      path: path.join('test', 'dialog.json'),
      type: 'json',
      content: JSON.stringify({
        "conv1": [
          "Cześć! Spotkamy się w 2024 roku?",
          "Tak, możemy się spotkać 15 stycznia w Warszawie.",
          "Świetnie, to do zobaczenia!"
        ],
        "conv2": [
          "Zygfryd wysłał numer piąty w przeszłość.",
          "Tak, przeniósł się do roku 1999.",
          "Ciekawe co tam znajdzie."
        ]
      })
    };

    // Test 2: Długi tekst markdown
    console.log('\n=== Test 2: Tekst markdown ===');
    const markdownContent: FileContent = {
      path: path.join('test', 'document.md'),
      type: 'markdown',
      content: `# Rozdział 1
      To jest długi tekst, który powinien zostać podzielony na mniejsze fragmenty.
      Zawiera różne informacje o podróżach w czasie.
      `.repeat(3)
    };

    // Przetwórz i zapisz dokumenty testowe
    for (const content of [jsonContent, markdownContent]) {
      console.log(`\nPrzetwarzanie pliku: ${content.path}`);
      
      // Najpierw zapisz dokument źródłowy
      const { data: sourceDoc, error: sourceError } = await supabase
        .from('source_documents')
        .insert({
          title: path.basename(content.path),
          file_path: content.path,
          document_type: content.type,
          original_content: content.content,
          total_chunks: 0,
          metadata: { test: true }
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Przetwórz plik
      const chunks = await vectorizationService.processFile(content);

      console.log(`\nWygenerowane chunki (${chunks.length}):`);
      for (const chunk of chunks) {
        // Zapisz chunk do bazy
        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            content: chunk.content,
            embedding: await createEmbedding(chunk.content),
            metadata: {
              ...chunk.metadata,
              test: true
            },
            source_document_id: sourceDoc.id
          });

        if (insertError) throw insertError;

        // Wyświetl informacje o chunku
        console.log('\nZapisano chunk:');
        console.log('Content:', chunk.content.substring(0, 100) + '...');
        console.log('Metadata:', {
          chunk_type: chunk.metadata.chunk_type,
          document_type: chunk.metadata.document_type,
          entities: chunk.metadata.entities,
          temporal: chunk.metadata.temporal,
          importance_score: chunk.metadata.importance_score,
          confidence_score: chunk.metadata.confidence_score
        });
      }

      // Zaktualizuj liczbę chunków w dokumencie źródłowym
      const { error: updateError } = await supabase
        .from('source_documents')
        .update({ total_chunks: chunks.length })
        .eq('id', sourceDoc.id);

      if (updateError) throw updateError;
    }

    // Test wyszukiwania
    console.log('\nTest wyszukiwania podobnych dokumentów:');
    const testQuery = "Kiedy Zygfryd przeniósł się w czasie?";
    const results = await vectorizationService.searchSimilarDocuments(testQuery, 3);

    if (results.length > 0) {
      results.forEach((doc, i) => {
        console.log(`\n${i + 1}. Podobieństwo: ${doc.similarity.toFixed(2)}`);
        console.log(`Treść: ${doc.content}`);
        console.log(`Metadata:`, doc.metadata);
      });
      console.log('✓ Test wyszukiwania: OK');
    } else {
      console.log('! Nie znaleziono podobnych dokumentów');
    }

    return true;
  } catch (error) {
    console.error('Błąd podczas testowania:', error);
    return false;
  }
}

// Uruchom test
testVectors()
  .then(success => {
    console.log('\nTest zakończony:', success ? 'SUKCES' : 'BŁĄD');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Błąd krytyczny:', error);
    process.exit(1);
  }); 