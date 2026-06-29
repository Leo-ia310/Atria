import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/branch.dto';

@ApiTags('Sucursales')
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.branchesService.list(user);
  }

  @Get('analytics')
  analytics(@CurrentUser() user: JwtUser) {
    return this.branchesService.analytics(user);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user, dto);
  }
}
