import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Configuración')
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('company')
  company(@CurrentUser() user: JwtUser) {
    return this.settingsService.company(user);
  }

  @Patch('company')
  update(@CurrentUser() user: JwtUser, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(user, dto);
  }

  @Get('security')
  security(@CurrentUser() user: JwtUser) {
    return this.settingsService.security(user);
  }
}
