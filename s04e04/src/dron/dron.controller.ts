import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { DronInstructionDto } from './dto/dron-instruction.dto';
import { OpenAiService } from '../openai/openai.service';

@Controller('dron')
export class DronController {
  constructor(private readonly openAiService: OpenAiService) {}

  @Post()
  @HttpCode(200)
  public async executeDronInstruction(
    @Body() dronInstructionDto: DronInstructionDto,
  ): Promise<{ description: string }> {
    console.log('Otrzymano instrukcję drona:', dronInstructionDto);
    const answer = await this.openAiService.getShortAnswer(
      dronInstructionDto.instruction
    );
    
    return {
      description: answer,
    };
  }

} 