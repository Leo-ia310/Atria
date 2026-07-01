import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  CreateCustomerDto,
  CreateQuotationDto,
  SalesQueryDto,
  UpdateCustomerDto,
  VoidSaleDto,
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

  @Patch('customers/:id')
  updateCustomer(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.salesService.updateCustomer(user, id, dto);
  }

  @Delete('customers/:id')
  deleteCustomer(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.salesService.deleteCustomer(user, id);
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

  @Delete('quotations/:id')
  deleteQuotation(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.salesService.deleteQuotation(user, id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.salesService.findOne(user, id);
  }

  @Post(':id/void')
  voidSale(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: VoidSaleDto,
  ) {
    return this.salesService.voidSale(user, id, dto);
  }
}
