import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CreateExportDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reportes')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('catalog')
  catalog() {
    return this.reportsService.catalog();
  }

  @Get('exports')
  exports(@CurrentUser() user: JwtUser) {
    return this.reportsService.exports(user);
  }

  @Post('exports')
  createExport(@CurrentUser() user: JwtUser, @Body() dto: CreateExportDto) {
    return this.reportsService.createExport(user, dto);
  }
}
