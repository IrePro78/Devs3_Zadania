import { IsString, IsNotEmpty } from 'class-validator';

export class HeartInstructionDto {
  @IsString()
  @IsNotEmpty()
  readonly question: string;
} 