import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { ChangePlanDto } from './dto/billing.dto';

@ApiTags('Billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('overview')
  overview(@CurrentUser() user: JwtUser) {
    return this.billingService.overview(user);
  }

  @Post('change-plan')
  changePlan(@CurrentUser() user: JwtUser, @Body() dto: ChangePlanDto) {
    return this.billingService.changePlan(user, dto);
  }
}
