import { TextAnalyzer } from './TextAnalyzer';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  if (!process.env.OPENAI_API_KEY || !process.env.CENTRAL_API_KEY) {
    throw new Error('Brak wymaganych kluczy API w zmiennych środowiskowych');
  }

  const note = `Podczas pobytu w Krakowie w 2019 roku, Barbara Zawadzka poznała swojego ówczesnego narzeczonego, a obecnie męża, Aleksandra Ragowskiego. Tam też poznali osobę prawdopodobnie powiązaną z ruchem oporu, której dane nie są nam znane. Istnieje podejrzenie, że już wtedy pracowali oni nad planami ograniczenia rozwoju sztucznej inteligencji, tłumacząc to względami bezpieczeństwa. Tajemniczy osobnik zajmował się także organizacją spotkań mających na celu podnoszenie wiedzy na temat wykorzystania sztucznej inteligencji przez programistów. Na spotkania te uczęszczała także Barbara.

W okolicach 2021 roku Ragowski udał się do Warszawy celem spotkania z profesorem Andrzejem Majem. Prawdopodobnie nie zabrał ze sobą żony, a cel ich spotkania nie jest do końca jasny.

Podczas pobytu w Warszawie, w instytucie profesora doszło do incydentu, w wyniku którego, jeden z laborantów - Rafał Bomba - zaginął. Niepotwierdzone źródła informacji podają jednak, że Rafał spędził około 2 lata, wynajmując pokój w pewnym hotelu. Dlaczego zniknął?  Przed kim się ukrywał? Z kim kontaktował się przez ten czas i dlaczego ujawnił się po tym czasie? Na te pytania nie znamy odpowiedzi, ale agenci starają się uzupełnić brakujące informacje.

Istnieje podejrzenie, że Rafał mógł być powiązany z ruchem oporu. Prawdopodobnie przekazał on notatki profesora Maja w ręce Ragowskiego, a ten po powrocie do Krakowa mógł przekazać je swojej żonie. Z tego powodu uwaga naszej jednostki skupia się na odnalezieniu Barbary.

Aktualne miejsce pobytu Barbary Zawadzkiej nie jest znane. Przypuszczamy jednak, że nie opuściła ona kraju.`;

  const analyzer = new TextAnalyzer(
    process.env.OPENAI_API_KEY,
    process.env.CENTRAL_API_KEY
  );
  
  try {
    console.log('Rozpoczynam analizę...');
    const initialAnalysis = await analyzer.analyzeText(note);
    console.log('Początkowa analiza:', initialAnalysis);
    
    const connections = await analyzer.findAllConnections(note);
    
    console.log('Analizuję zebrane dane...');
    const enhancedNote = await analyzer.analyzeAllData(note, connections.people, connections.places);
    
    const report = `
Analiza powiązań:

Wszystkie znalezione osoby (${connections.people.size}):
${Array.from(connections.people).join(', ')}

Wszystkie znalezione miasta (${connections.places.size}):
${Array.from(connections.places).join(', ')}

=== SZCZEGÓŁOWA ANALIZA POWIĄZAŃ ===
Szczególny nacisk na osobę AZAZELA i jego związek z LUBLINEM
oraz możliwe powiązania z BARBARĄ

${enhancedNote}
`;

    console.log('Zapisuję wyniki do pliku...');
    await fs.writeFile('wynik.txt', report, 'utf-8');
    console.log('Zakończono analizę. Wyniki zapisano w pliku wynik.txt');
  } catch (error) {
    console.error('Wystąpił błąd podczas wykonywania programu:', error);
  }
}

main().catch(console.error); 