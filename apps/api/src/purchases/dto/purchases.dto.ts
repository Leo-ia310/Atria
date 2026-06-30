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

class PurchaseItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  unitCost!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taxAmount?: number;
}

export class PurchasesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class CreatePurchaseDto {
  @ApiProperty()
  @IsString()
  supplierId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @ApiProperty({ enum: ['CASH', 'CREDIT'] })
  @IsIn(['CASH', 'CREDIT'])
  paymentTerms!: 'CASH' | 'CREDIT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}

export class CreateSupplierDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxIdentifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;
}
