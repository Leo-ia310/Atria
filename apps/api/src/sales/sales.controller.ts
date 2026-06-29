import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  CreateCustomerDto,
  CreateQuotationDto,
  SalesQueryDto,
} from './dto/sales.dto';
import { SalesService } from './sales.service';

@ApiTags('Ventas')
@Controller({ path: 'sales', version: '1' })
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  sales(@CurrentUser() user: JwtUser, @Query() query: SalesQueryDto) {
    return this.salesService.sales(user, query);
  }

  @Get('analytics')
  analytics(@CurrentUser() user: JwtUser) {
    return this.salesService.analytics(user);
  }

  @Get('customers')
  customers(@CurrentUser() user: JwtUser) {
    return this.salesService.customers(user);
  }

  @Post('customers')
  createCustomer(@CurrentUser() user: JwtUser, @Body() dto: CreateCustomerDto) {
    return this.salesService.createCustomer(user, dto);
  }

  @Get('quotations')
  quotations(@CurrentUser() user: JwtUser) {
    return this.salesService.quotations(user);
  }

  @Post('quotations')
  createQuotation(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.salesService.createQuotation(user, dto);
  }
}
