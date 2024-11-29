import { Module } from '@nestjs/common';
import { DronController } from './dron.controller';
import { OpenAiModule } from '../openai/openai.module';

@Module({
  imports: [OpenAiModule],
  controllers: [DronController],
})
export class DronModule {} 