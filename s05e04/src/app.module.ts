import { Module } from '@nestjs/common';
import { HeartModule } from './heart/heart.module';
import { OpenAiModule } from './openai/openai.module';

@Module({
  imports: [HeartModule, OpenAiModule],
})
export class AppModule {} 