import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  CreatePurchaseDto,
  CreateSupplierDto,
  PurchasesQueryDto,
} from './dto/purchases.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('Compras')
@Controller({ path: 'purchases', version: '1' })
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: PurchasesQueryDto) {
    return this.purchasesService.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(user, dto);
  }

  @Get('suppliers')
  suppliers(@CurrentUser() user: JwtUser) {
    return this.purchasesService.suppliers(user);
  }

  @Post('suppliers')
  createSupplier(@CurrentUser() user: JwtUser, @Body() dto: CreateSupplierDto) {
    return this.purchasesService.createSupplier(user, dto);
  }

  @Get(':referenceId')
  findOne(@CurrentUser() user: JwtUser, @Param('referenceId') referenceId: string) {
    return this.purchasesService.findOne(user, referenceId);
  }
}
