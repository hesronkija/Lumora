import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsOptional, IsArray, ValidateNested,
  IsBoolean, IsNumberString, IsDateString, IsInt, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountingService } from './accounting.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';
import { TenantStorage } from '@lumora/shared-tenancy';

class AccountDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsEnum(['asset', 'liability', 'equity', 'income', 'expense']) type!: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  @IsEnum(['debit', 'credit']) normalBalance!: 'debit' | 'credit';
  @IsUUID() @IsOptional() parentId?: string;
  @IsBoolean() @IsOptional() isControl?: boolean;
  @IsInt() @IsOptional() sortOrder?: number;
}

class PeriodDto {
  @IsString() label!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
}

class ClosePeriodDto {
  @IsUUID() closedByUserId!: string;
}

class JournalLineDto {
  @IsUUID() accountId!: string;
  @IsNumberString() @IsOptional() dr?: string;
  @IsNumberString() @IsOptional() cr?: string;
  @IsString() @IsOptional() description?: string;
}

class PostJournalDto {
  @IsUUID() periodId!: string;
  @IsDateString() entryDate!: string;
  @IsString() narrative!: string;
  @IsEnum(['payments', 'payroll', 'manual', 'bank_recon', 'reversal']) sourceModule!: 'payments' | 'payroll' | 'manual' | 'bank_recon' | 'reversal';
  @IsString() @IsOptional() sourceRef?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => JournalLineDto) lines!: JournalLineDto[];
}

class ReverseJournalDto {
  @IsDateString() reversalDate!: string;
  @IsUUID() postedByUserId!: string;
}

class BankStatementLineDto {
  @IsDateString() txnDate!: string;
  @IsString() description!: string;
  @IsString() @IsOptional() ref?: string;
  @IsNumberString() debit!: string;
  @IsNumberString() credit!: string;
  @IsNumberString() balance!: string;
}

class ImportBankStatementDto {
  @IsUUID() accountId!: string;
  @IsString() bankName!: string;
  @IsDateString() statementDate!: string;
  @IsNumberString() openingBalance!: string;
  @IsNumberString() closingBalance!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BankStatementLineDto) lines!: BankStatementLineDto[];
}

class ClearBankLineDto {
  @IsUUID() journalLineId!: string;
}

class BudgetLineInputDto {
  @IsUUID() accountId!: string;
  @IsNumberString() amount!: string;
  @IsString() @IsOptional() note?: string;
}

class CreateBudgetDto {
  @IsUUID() periodId!: string;
  @IsString() name!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BudgetLineInputDto) lines!: BudgetLineInputDto[];
}

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting')
@UseGuards(AuthGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ── Chart of Accounts ──────────────────────────────────────────────────────

  @Post('accounts')
  @Roles('owner', 'headteacher', 'bursar', 'accountant')
  createAccount(@Body() dto: AccountDto) {
    return this.accountingService.createAccount(dto);
  }

  @Get('accounts')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  listAccounts(@Query('type') type?: string) {
    return this.accountingService.listAccounts(type);
  }

  @Post('accounts/seed-defaults')
  @Roles('owner')
  seedDefaults() {
    return this.accountingService.seedDefaultChartOfAccounts();
  }

  // ── Periods ────────────────────────────────────────────────────────────────

  @Post('periods')
  @Roles('owner', 'bursar', 'accountant')
  createPeriod(@Body() dto: PeriodDto) {
    return this.accountingService.createPeriod(dto);
  }

  @Get('periods')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  listPeriods() {
    return this.accountingService.listPeriods();
  }

  @Patch('periods/:id/close')
  @Roles('owner', 'bursar', 'accountant')
  closePeriod(@Param('id') id: string, @Body() dto: ClosePeriodDto) {
    return this.accountingService.closePeriod(id, dto.closedByUserId);
  }

  // ── Journals ───────────────────────────────────────────────────────────────

  @Post('journals')
  @Roles('owner', 'bursar', 'accountant')
  postJournal(@Body() dto: PostJournalDto) {
    const { userId } = TenantStorage.get();
    return this.accountingService.postJournal(dto, userId);
  }

  @Get('journals')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  listJournals(
    @Query('periodId') periodId?: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.accountingService.listJournalEntries(periodId, +limit, +offset);
  }

  @Get('journals/:id')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  getJournal(@Param('id') id: string) {
    return this.accountingService.getJournalEntry(id);
  }

  @Post('journals/:id/reverse')
  @Roles('owner', 'bursar', 'accountant')
  reverseJournal(@Param('id') id: string, @Body() dto: ReverseJournalDto) {
    return this.accountingService.reverseJournal(id, dto.reversalDate, dto.postedByUserId);
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  @Get('reports/trial-balance')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  trialBalance(@Query('periodId') periodId: string) {
    return this.accountingService.trialBalance(periodId);
  }

  @Get('reports/income-statement')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  incomeStatement(@Query('periodId') periodId: string) {
    return this.accountingService.incomeStatement(periodId);
  }

  @Get('reports/balance-sheet')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  balanceSheet(@Query('asOf') asOf: string) {
    return this.accountingService.balanceSheet(asOf);
  }

  @Get('reports/audit-export')
  @Roles('owner', 'auditor')
  auditExport(@Query('from') from: string, @Query('to') to: string) {
    return this.accountingService.auditExport(from, to);
  }

  // ── Budget ─────────────────────────────────────────────────────────────────

  @Post('budgets')
  @Roles('owner', 'headteacher', 'bursar', 'accountant')
  createBudget(@Body() dto: CreateBudgetDto) {
    return this.accountingService.createBudget(dto);
  }

  @Get('budgets/:id/variance')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  budgetVariance(@Param('id') id: string) {
    return this.accountingService.budgetVariance(id);
  }

  // ── Bank Reconciliation ────────────────────────────────────────────────────

  @Post('bank-statements')
  @Roles('owner', 'bursar', 'accountant')
  importStatement(@Body() dto: ImportBankStatementDto) {
    return this.accountingService.importBankStatement(dto);
  }

  @Get('bank-statements/:id/unreconciled')
  @Roles('owner', 'bursar', 'accountant')
  unreconciledLines(@Param('id') id: string) {
    return this.accountingService.getUnreconciledLines(id);
  }

  @Patch('bank-statements/lines/:lineId/clear')
  @Roles('owner', 'bursar', 'accountant')
  clearLine(@Param('lineId') lineId: string, @Body() dto: ClearBankLineDto) {
    return this.accountingService.clearBankLine(lineId, dto.journalLineId);
  }
}
