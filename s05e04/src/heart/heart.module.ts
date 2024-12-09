import { Module } from '@nestjs/common';
import { HeartController } from './heart.controller';
import { OpenAiModule } from '../openai/openai.module';

@Module({
  imports: [OpenAiModule],
  controllers: [HeartController],
})
export class HeartModule {} 