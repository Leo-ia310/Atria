import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class CreateExportDto {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsString()
  format!: string;

  @ApiProperty()
  @IsObject()
  filters!: Record<string, unknown>;
}
