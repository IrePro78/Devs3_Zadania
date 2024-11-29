import { Module } from '@nestjs/common';
import { DronModule } from './dron/dron.module';
import { OpenAiModule } from './openai/openai.module';

@Module({
  imports: [DronModule, OpenAiModule],
})
export class AppModule {} 