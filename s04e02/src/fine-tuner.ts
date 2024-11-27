import { OpenAI } from 'openai';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class FineTuner {
    private openai: OpenAI;

    constructor(apiKey: string) {
        this.openai = new OpenAI({ apiKey });
        console.log('🚀 Inicjalizacja fine-tunera...');
    }

    async startFineTuning(jsonlPath: string): Promise<void> {
        try {
            console.log('\n📤 Przygotowanie do wysłania pliku treningowego...');
            
            // Sprawdź czy plik istnieje
            if (!fs.existsSync(jsonlPath)) {
                throw new Error(`Plik JSONL nie istnieje: ${jsonlPath}`);
            }

            // Wgraj plik treningowy
            console.log('📦 Uploading training file...');
            const file = await this.openai.files.create({
                file: fs.createReadStream(jsonlPath),
                purpose: 'fine-tune'
            });

            console.log(`✅ Plik został wgrany, ID: ${file.id}`);

            // Rozpocznij fine-tuning
            console.log('\n🔄 Rozpoczynanie procesu fine-tuningu...');
            const fineTune = await this.openai.fineTuning.jobs.create({
                training_file: file.id,
                model: 'gpt-4o-mini-2024-07-18',
                suffix: 'custom-analyzer'
            });

            console.log('\n✨ Fine-tuning rozpoczęty pomyślnie!');
            console.log(`📋 Job ID: ${fineTune.id}`);
            console.log(`🕒 Status: ${fineTune.status}`);
            
            // Monitoruj postęp
            await this.monitorFineTuning(fineTune.id);

        } catch (error) {
            console.error('❌ Błąd podczas fine-tuningu:', error);
            throw error;
        }
    }

    private async monitorFineTuning(jobId: string): Promise<void> {
        console.log('\n📊 Monitorowanie postępu fine-tuningu...');
        
        let isCompleted = false;
        while (!isCompleted) {
            const job = await this.openai.fineTuning.jobs.retrieve(jobId);
            
            console.log(`\nStatus: ${job.status}`);
            if (job.trained_tokens) {
                console.log(`Przetrenowane tokeny: ${job.trained_tokens}`);
            }

            switch (job.status) {
                case 'succeeded':
                    console.log('\n🎉 Fine-tuning zakończony sukcesem!');
                    console.log(`🤖 Model ID: ${job.fine_tuned_model}`);
                    isCompleted = true;
                    break;
                case 'failed':
                    throw new Error('Fine-tuning failed: ' + job.error);
                case 'cancelled':
                    throw new Error('Fine-tuning został anulowany');
                default:
                    // Czekaj 10 sekund przed kolejnym sprawdzeniem
                    await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }
} 