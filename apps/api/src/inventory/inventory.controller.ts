import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CreateProductDto, InventoryQueryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventario')
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('products')
  products(@CurrentUser() user: JwtUser, @Query() query: InventoryQueryDto) {
    return this.inventoryService.products(user, query);
  }

  @Post('products')
  createProduct(@CurrentUser() user: JwtUser, @Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(user, dto);
  }

  @Get('alerts')
  alerts(@CurrentUser() user: JwtUser) {
    return this.inventoryService.alerts(user);
  }

  @Get('movements')
  movements(@CurrentUser() user: JwtUser) {
    return this.inventoryService.movements(user);
  }
}
