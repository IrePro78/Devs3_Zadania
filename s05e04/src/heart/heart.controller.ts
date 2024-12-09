import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { HeartInstructionDto } from './dto/heart-instruction.dto';
import { OpenAiService } from '../openai/openai.service';
import { HeartResponse } from './interfaces/heart-response.interface';

@Controller('heart')
export class HeartController {
  private readonly logger = new Logger(HeartController.name);
  
  constructor(private readonly openAiService: OpenAiService) {}

  @Post()
  @HttpCode(200)
  async executeInstruction(@Body() heartInstructionDto: HeartInstructionDto): Promise<HeartResponse> {
    console.log('--------------------');
    console.log(`Pytanie: ${heartInstructionDto.question}`);
    const response = await this.openAiService.getShortAnswer(heartInstructionDto.question);
    console.log(`Odpowiedź: ${response}`);
    console.log('--------------------');
    
    return {
      answer: response
    };
  }
} 