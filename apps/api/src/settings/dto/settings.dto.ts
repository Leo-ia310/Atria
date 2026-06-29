import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quotePrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  themePrimary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  themeSecondary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  posAllowDiscounts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  posRequireCustomer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notifications?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  security?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  invoiceTemplate?: Record<string, unknown>;
}
