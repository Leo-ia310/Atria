import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto } from './dto/onboarding.dto';

@ApiTags('Onboarding')
@Controller({ path: 'onboarding', version: '1' })
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('state')
  state(@CurrentUser() user: JwtUser) {
    return this.onboardingService.state(user);
  }

  @Post('complete')
  complete(@CurrentUser() user: JwtUser, @Body() dto: CompleteOnboardingDto) {
    return this.onboardingService.complete(user, dto);
  }
}
