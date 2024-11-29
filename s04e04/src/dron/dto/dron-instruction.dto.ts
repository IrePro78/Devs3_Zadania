import { IsString, IsNotEmpty } from 'class-validator';

export class DronInstructionDto {
  @IsString()
  @IsNotEmpty()
  readonly instruction: string;
} 