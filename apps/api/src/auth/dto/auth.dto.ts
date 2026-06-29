import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RegisterBranchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @ApiProperty({
    enum: [
      'HARDWARE',
      'PHARMACY',
      'RETAIL',
      'DISTRIBUTOR',
      'MEDICAL_SUPPLY',
      'OTHER',
    ],
  })
  @IsString()
  @IsIn([
    'HARDWARE',
    'PHARMACY',
    'RETAIL',
    'DISTRIBUTOR',
    'MEDICAL_SUPPLY',
    'OTHER',
  ])
  businessType!:
    | 'HARDWARE'
    | 'PHARMACY'
    | 'RETAIL'
    | 'DISTRIBUTOR'
    | 'MEDICAL_SUPPLY'
    | 'OTHER';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  countryCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currencyCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  timezone!: string;

  @ApiProperty({ type: RegisterBranchDto })
  @ValidateNested()
  @Type(() => RegisterBranchDto)
  primaryBranch!: RegisterBranchDto;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;
}

export class RevokeSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}

export class IssueCsrfDto {
  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  scopes?: string[];
}
