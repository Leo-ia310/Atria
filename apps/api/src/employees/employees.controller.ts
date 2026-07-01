import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employees.dto';
import { EmployeesService } from './employees.service';

@ApiTags('Empleados')
@Controller({ path: 'employees', version: '1' })
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.employeesService.list(user);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user, dto);
  }

  @Get('attendance')
  attendance(@CurrentUser() user: JwtUser) {
    return this.employeesService.attendance(user);
  }

  @Get('activity')
  activity(@CurrentUser() user: JwtUser) {
    return this.employeesService.activity(user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.employeesService.remove(user, id);
  }
}
