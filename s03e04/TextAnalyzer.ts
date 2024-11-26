import OpenAI from 'openai';
import { TextAnalysisResult, Person, Place, ApiResponse } from './types';

interface ApiMessageResponse {
  code: number;
  message: string;
}

export class TextAnalyzer {
  private openai: OpenAI;
  private peopleApiUrl = 'https://centrala.ag3nts.org/people';
  private placesApiUrl = 'https://centrala.ag3nts.org/places';
  private centralApiKey: string;

  constructor(openaiApiKey: string, centralApiKey: string) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey
    });
    this.centralApiKey = centralApiKey;
  }

  async analyzeText(text: string): Promise<TextAnalysisResult> {
    const prompt = `
      Przeanalizuj poniższy tekst i wyodrębnij wszystkie wymienione imiona osób i miasta.
      Zwróć tylko imiona (bez nazwisk) i nazwy miast i tylko dużymi literami muszą być bez polskich znaków diakrytycznych.
      Odpowiedz wyłącznie samym obiektem JSON bez żadnych dodatkowych znaków.
      Format odpowiedzi: {"people":["IMIE1","IMIE2"],"places":["MIASTO1","MIASTO2"]}
      
      Tekst do analizy: ${text}
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('Brak odpowiedzi od OpenAI');
      }

      const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleanContent);
    } catch (error) {
      console.error('Błąd podczas analizy tekstu:', error);
      return { people: [], places: [] };
    }
  }

  private async makeApiRequest(url: string, query: string): Promise<string[]> {
    try {
      const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      console.log(`\nWysyłam zapytanie do ${url} dla: ${query}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apikey: this.centralApiKey,
          query: normalizedQuery
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonResponse = await response.json() as ApiMessageResponse;
      console.log(`Surowa odpowiedź dla ${query}:`, jsonResponse);
      
      if (jsonResponse.message) {
        // Sprawdź, czy to odpowiedź dla miasta
        if (url === this.placesApiUrl) {
          console.log(`\nWeryfikacja odpowiedzi dla miasta ${query}:`);
          console.log('Oryginalna wiadomość:', jsonResponse.message);
          
          // Usuń znaki specjalne i podziel na słowa
          const cleanedMessage = jsonResponse.message
            .replace(/"/g, '')
            .replace(/\[|\]/g, '')
            .replace(/\{|\}/g, '')
            .replace(/code:|message:/g, '')
            .trim();
            
          console.log('Oczyszczona wiadomość:', cleanedMessage);
          
          // Podziel na słowa i odfiltruj puste
          const words = cleanedMessage
            .split(/[\s,;]+/)
            .filter((word: string) => 
              word.length > 0 && 
              !['code', 'message', '{', '}', '[', ']', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(word)
            );
            
          console.log('Znalezione osoby w mieście:', words);
          return words;
        } else {
          // Dla osób zostawiamy poprzednią logikę
          const locations = jsonResponse.message
            .replace(/"/g, '')
            .split(/[\s,;]+/)
            .filter((word: string) => word.length > 0 && !['code', 'message', '{', '}'].includes(word));
          
          console.log(`Przetworzone lokalizacje dla ${query}:`, locations);
          return locations;
        }
      }
      
      return [];
    } catch (error) {
      console.error(`Błąd zapytania dla ${query}:`, error);
      return [];
    }
  }

  async findAllConnections(text: string): Promise<{
    people: Set<string>,
    places: Set<string>
  }> {
    // 1. Znajdź początkowe osoby i miasta
    const initialData = await this.analyzeText(text);
    console.log('\nPoczątkowe osoby:', initialData.people);
    
    const people = new Set<string>(initialData.people);
    const places = new Set<string>();

    let hasNewData = true;
    let iteration = 0;

    while (hasNewData) {
      hasNewData = false;
      iteration++;
      console.log(`\n=== ITERACJA ${iteration} ===`);

      // Zapisz aktualną liczbę osób i miejsc
      const prevPeopleCount = people.size;
      const prevPlacesCount = places.size;

      // 2. Dla każdej osoby znajdź miasta
      console.log('\nSprawdzam miasta dla wszystkich osób:');
      for (const person of Array.from(people)) {
        const locations = await this.makeApiRequest(this.peopleApiUrl, person);
        console.log(`Miasta dla ${person}:`, locations);
        locations.forEach(location => places.add(location));
      }
      console.log('\nAktualne miasta:', Array.from(places));

      // 3. Dla każdego miasta znajdź osoby
      console.log('\nSprawdzam osoby dla wszystkich miast:');
      for (const place of Array.from(places)) {
        console.log(`\n=== Sprawdzam miasto: ${place} ===`);
        const visitors = await this.makeApiRequest(this.placesApiUrl, place);
        console.log(`Znalezione osoby w ${place}:`, visitors);
        visitors.forEach(visitor => people.add(visitor));
      }
      console.log('\nAktualne osoby:', Array.from(people));

      // Sprawdź, czy znaleziono nowe dane
      if (people.size > prevPeopleCount || places.size > prevPlacesCount) {
        hasNewData = true;
        console.log('\nZnaleziono nowe dane:');
        console.log(`Nowe osoby: ${people.size - prevPeopleCount}`);
        console.log(`Nowe miasta: ${places.size - prevPlacesCount}`);
      } else {
        console.log('\nNie znaleziono nowych danych - kończę poszukiwania');
      }
    }

    console.log('\n=== KOŃCOWE WYNIKI ===');
    console.log('Liczba iteracji:', iteration);
    console.log('Wszystkie znalezione osoby:', Array.from(people));
    console.log('Wszystkie znalezione miasta:', Array.from(places));

    return { people, places };
  }

  async analyzeAllData(
    originalNote: string, 
    people: Set<string>, 
    places: Set<string>
  ): Promise<string> {
    const prompt = `
      Przeanalizuj oryginalną notatkę oraz dodatkowe dane o osobach i miejscach.
      Szczególnie zwróć uwagę na osobę o imieniu AZAZEL i jego powiązania z miastem LUBLIN.
      Na podstawie tych informacji:
      1. Uzupełnij notatkę o nowe powiązania między osobami i miejscami
      2. Przeanalizuj rolę AZAZELA w całej sprawie i jego związek z LUBLINEM
      3. Sprawdź, czy istnieją powiązania między AZAZELEM a BARBARĄ
      4. Zastanów się, czy obecność AZAZELA w LUBLINIE może wskazywać na możliwą lokalizację BARBARY
      5. Wyciągnij logiczne wnioski z połączonych danych

      Oryginalna notatka:
      ${originalNote}

      Dodatkowe dane:
      Wszystkie znalezione osoby: ${Array.from(people).join(', ')}
      Wszystkie znalezione miasta: ${Array.from(places).join(', ')}

      Odpowiedz w formie rozszerzonej notatki analitycznej, która:
      - Analizuje rolę AZAZELA
      - Wyjaśnia znaczenie LUBLINA
      - Sugeruje możliwe powiązania z BARBARĄ
      - Przedstawia hipotezy dotyczące obecnej lokalizacji BARBARY
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      return completion.choices[0].message.content || 'Nie udało się wygenerować analizy.';
    } catch (error) {
      console.error('Błąd podczas analizy danych:', error);
      return 'Wystąpił błąd podczas analizy danych.';
    }
  }
} 