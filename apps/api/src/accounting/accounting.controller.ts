import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtUser } from '@/auth/auth.types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AccountingService } from './accounting.service';
import {
  CreateJournalEntryDto,
  JournalEntriesQueryDto,
  VoidJournalEntryDto,
} from './dto/accounting.dto';

@ApiTags('Contabilidad')
@Controller({ path: 'accounting', version: '1' })
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtUser) {
    return this.accountingService.summary(user);
  }

  @Get('accounts')
  accounts(@CurrentUser() user: JwtUser) {
    return this.accountingService.accounts(user);
  }

  @Get('trial-balance')
  trialBalance(@CurrentUser() user: JwtUser) {
    return this.accountingService.trialBalance(user);
  }

  @Get('entries')
  entries(@CurrentUser() user: JwtUser, @Query() query: JournalEntriesQueryDto) {
    return this.accountingService.entries(user, query);
  }

  @Post('entries')
  createEntry(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.accountingService.createEntry(user, dto);
  }

  @Post('entries/:id/void')
  voidEntry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: VoidJournalEntryDto,
  ) {
    return this.accountingService.voidEntry(user, id, dto);
  }
}
