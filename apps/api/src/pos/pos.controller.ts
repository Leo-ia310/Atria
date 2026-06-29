import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PosCatalogQueryDto, PosCheckoutDto } from './dto/pos.dto';
import { PosService } from './pos.service';

@ApiTags('POS')
@Controller({ path: 'pos', version: '1' })
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('catalog')
  catalog(@CurrentUser() user: JwtUser, @Query() query: PosCatalogQueryDto) {
    return this.posService.catalog(user, query);
  }

  @Get('suspended')
  suspended(@CurrentUser() user: JwtUser) {
    return this.posService.suspended(user);
  }

  @Post('checkout')
  checkout(@CurrentUser() user: JwtUser, @Body() dto: PosCheckoutDto) {
    return this.posService.checkout(user, dto);
  }
}
