import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class TaxDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNumber()
  rate!: number;

  @ApiProperty({ enum: ['SALE', 'PURCHASE', 'BOTH'] })
  @IsString()
  @IsIn(['SALE', 'PURCHASE', 'BOTH'])
  scope!: 'SALE' | 'PURCHASE' | 'BOTH';
}

class InitialUserDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;

  @ApiProperty({ enum: ['owner', 'admin', 'worker', 'accountant'] })
  @IsString()
  roleKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string;
}

class InitialProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty()
  @IsNumber()
  salePrice!: number;

  @ApiProperty()
  @IsNumber()
  costPrice!: number;

  @ApiProperty()
  @IsNumber()
  minStock!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryName?: string;
}

export class CompleteOnboardingDto {
  @ApiProperty()
  @IsString()
  businessType!: string;

  @ApiProperty()
  @IsString()
  countryCode!: string;

  @ApiProperty()
  @IsString()
  currencyCode!: string;

  @ApiProperty()
  @IsString()
  timezone!: string;

  @ApiProperty()
  @IsString()
  primaryBranchName!: string;

  @ApiProperty({ type: [TaxDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxDto)
  taxes!: TaxDto[];

  @ApiProperty({ type: [InitialUserDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialUserDto)
  initialUsers!: InitialUserDto[];

  @ApiProperty({ type: [InitialProductDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialProductDto)
  initialProducts!: InitialProductDto[];
}
