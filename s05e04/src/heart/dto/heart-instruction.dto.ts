import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class HeartInstructionDto {
  @IsString()
  @IsNotEmpty()
  readonly question: string;

  @IsOptional()
  @IsUrl()
  readonly audioUrl?: string;

  @IsOptional()
  @IsUrl()
  readonly imageUrl?: string;
} 