import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({ enum: ['BUSINESS', 'ENTERPRISE'] })
  @IsString()
  @IsIn(['BUSINESS', 'ENTERPRISE'])
  planCode!: 'BUSINESS' | 'ENTERPRISE';
}
