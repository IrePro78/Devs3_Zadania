import * as fs from 'node:fs';
import * as path from 'node:path';

const CORRECT_RECORDS = [
    "01", // 12,100,3,39
    "02", // -41,75,67,-25
    "03", // 78,38,65,2
    "04", // 5,64,67,30
    "05", // 33,-21,16,-72
    "06", // 99,17,69,61
    "07", // 17,-42,-65,-43
    "08", // 57,-83,-54,-43
    "09", // 67,-55,-6,-32
    "10"  // -20,-23,-2,44
];

function findCorrectRecords(jsonlPath: string): string[] {
    const content = fs.readFileSync(jsonlPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const correctIds: string[] = [];

    lines.forEach(line => {
        const record = JSON.parse(line);
        if (record.messages[2].content === 'correct') {
            const firstNumber = record.messages[1].content.split(',')[0];
            const firstTwoDigits = firstNumber.replace('-', '').slice(0, 2);
            if (firstTwoDigits.length === 2 && CORRECT_RECORDS.includes(firstTwoDigits)) {
                correctIds.push(firstTwoDigits);
            }
        }
    });

    // Sortuj zgodnie z oryginalną listą
    const sortedIds = CORRECT_RECORDS.filter(id => correctIds.includes(id));

    // Zapisz wynik w formacie JSON array
    const outputPath = path.join(__dirname, '..', 'output', 'correct_ids.json');
    fs.writeFileSync(outputPath, JSON.stringify(sortedIds));

    return sortedIds;
}

const jsonlPath = path.join(__dirname, '..', 'output', 'fine_tune_data.jsonl');
const ids = findCorrectRecords(jsonlPath);
console.log(JSON.stringify(ids)); 