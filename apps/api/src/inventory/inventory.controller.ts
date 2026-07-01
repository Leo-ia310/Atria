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
  CreateProductDto,
  InventoryQueryDto,
  UpdateProductDto,
} from './dto/inventory.dto';
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

  @Get('products/:id')
  productDetail(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.inventoryService.productDetail(user, id);
  }

  @Patch('products/:id')
  updateProduct(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.inventoryService.updateProduct(user, id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.inventoryService.deleteProduct(user, id);
  }

  @Get('alerts')
  alerts(@CurrentUser() user: JwtUser) {
    return this.inventoryService.alerts(user);
  }

  @Get('filters')
  filters(@CurrentUser() user: JwtUser) {
    return this.inventoryService.filters(user);
  }

  @Get('movements')
  movements(
    @CurrentUser() user: JwtUser,
    @Query('productId') productId?: string,
  ) {
    return this.inventoryService.movements(user, productId);
  }
}
