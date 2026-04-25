import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsOptional, IsArray, ValidateNested,
  IsBoolean, IsNumberString, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollService } from './payroll.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class EarningDto {
  @IsString() code!: string;
  @IsString() label!: string;
  @IsNumberString() amount!: string;
}

class DeductionDto {
  @IsString() code!: string;
  @IsString() label!: string;
  @IsNumberString() amount!: string;
}

class StaffPayInputDto {
  @IsUUID() staffId!: string;
  @IsEnum(['nssf', 'psssf', 'none']) pensionFund!: 'nssf' | 'psssf' | 'none';
  @IsBoolean() hasHeslbLoan!: boolean;
  @IsEnum(['bank', 'mobile_money', 'cash']) disbursementMethod!: 'bank' | 'mobile_money' | 'cash';
  @IsString() @IsOptional() bankAccount?: string;
  @IsString() @IsOptional() mobileNumber?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => EarningDto) earnings!: EarningDto[];
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => DeductionDto) otherDeductions?: DeductionDto[];
}

class ApproveRunDto {
  @IsUUID() approvedByUserId!: string;
}

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
@UseGuards(AuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ── Payroll Runs ───────────────────────────────────────────────────────────

  @Post('runs')
  @Roles('owner', 'hr', 'bursar', 'accountant')
  createRun(@Body('period') period: string) {
    return this.payrollService.createPayrollRun(period);
  }

  @Get('runs')
  @Roles('owner', 'headteacher', 'hr', 'bursar', 'accountant', 'auditor')
  listRuns() {
    return this.payrollService.listPayrollRuns();
  }

  @Get('runs/:id')
  @Roles('owner', 'headteacher', 'hr', 'bursar', 'accountant', 'auditor')
  getRun(@Param('id') id: string) {
    return this.payrollService.getPayrollRun(id);
  }

  @Post('runs/:id/payslips')
  @Roles('owner', 'hr', 'bursar', 'accountant')
  addPayslip(@Param('id') id: string, @Body() dto: StaffPayInputDto) {
    return this.payrollService.addPayslip(id, dto);
  }

  @Post('runs/:id/approve')
  @Roles('owner', 'headteacher')
  approveRun(@Param('id') id: string, @Body() dto: ApproveRunDto) {
    return this.payrollService.approvePayrollRun(id, dto.approvedByUserId);
  }

  @Get('runs/:id/disbursement-file')
  @Roles('owner', 'bursar', 'accountant')
  disbursementFile(@Param('id') id: string) {
    return this.payrollService.bulkDisbursementFile(id);
  }

  // ── Payslips ───────────────────────────────────────────────────────────────

  @Get('payslips/:id')
  @Roles('owner', 'hr', 'bursar', 'accountant', 'auditor')
  getPayslip(@Param('id') id: string) {
    return this.payrollService.getPayslip(id);
  }

  // ── Calculations (preview — does not persist) ──────────────────────────────

  @Post('calculate')
  @Roles('owner', 'hr', 'bursar', 'accountant')
  calculate(@Body() dto: StaffPayInputDto) {
    // Conservative employee count — does not persist; preview only
    return this.payrollService.calculatePayslip(dto, 10);
  }

  // ── Statutory Returns ──────────────────────────────────────────────────────

  @Get('returns/paye')
  @Roles('owner', 'bursar', 'accountant', 'auditor')
  payeReturn(@Query('period') period: string) {
    return this.payrollService.payeReturn(period);
  }

  @Get('returns/nssf')
  @Roles('owner', 'hr', 'bursar', 'accountant', 'auditor')
  nssfFile(@Query('period') period: string) {
    return this.payrollService.nssfContributionFile(period);
  }
}
