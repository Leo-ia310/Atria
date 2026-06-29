import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

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
