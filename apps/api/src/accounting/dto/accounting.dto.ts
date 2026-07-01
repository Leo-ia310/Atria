import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class JournalEntriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'POSTED', 'REVERSED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'POSTED', 'REVERSED'])
  status?: 'DRAFT' | 'POSTED' | 'REVERSED';
}

class EntryLineDto {
  @ApiProperty()
  @IsString()
  accountId!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  debit!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  credit!: number;
}

export class CreateJournalEntryDto {
  @ApiProperty()
  @IsString()
  memo!: string;

  @ApiProperty()
  @IsDateString()
  entryDate!: string;

  @ApiProperty({ type: [EntryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntryLineDto)
  lines!: EntryLineDto[];
}

export class VoidJournalEntryDto {
  @ApiPropertyOptional({ description: 'Motivo de anulación (auditoría).' })
  @IsOptional()
  @IsString()
  reason?: string;
}
