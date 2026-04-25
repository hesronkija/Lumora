import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsBoolean, IsNumberString } from 'class-validator';
import { Type } from 'class-transformer';
import { FeesService } from './fees.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class FeeItemDto {
  @IsString() code!: string;
  @IsString() label!: string;
  @IsNumberString() amount!: string;
  @IsBoolean() mandatory!: boolean;
}

class DiscountDto {
  @IsString() code!: string;
  @IsNumberString() amount!: string;
  @IsString() reason!: string;
}

class CreateFeeStructureDto {
  @IsString() name!: string;
  @IsString() termId!: string;
  @IsString() @IsOptional() classId?: string;
  @IsEnum(['day', 'boarder', 'all']) @IsOptional() studentType?: 'day' | 'boarder' | 'all';
  @IsArray() @ValidateNested({ each: true }) @Type(() => FeeItemDto) items!: FeeItemDto[];
}

class GenerateInvoiceDto {
  @IsString() studentId!: string;
  @IsString() termId!: string;
  @IsString() feeStructureId!: string;
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => DiscountDto) discounts?: DiscountDto[];
}

@ApiTags('fees')
@ApiBearerAuth()
@Controller('fees')
@UseGuards(AuthGuard)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  // ── Fee Structures ──────────────────────────────────────────────────────────

  @Post('structures')
  @Roles('owner', 'headteacher', 'bursar', 'accountant')
  createStructure(@Body() dto: CreateFeeStructureDto) {
    return this.feesService.createFeeStructure(dto);
  }

  @Get('structures')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  listStructures(@Query('termId') termId?: string) {
    return this.feesService.listFeeStructures(termId);
  }

  // ── Invoices ────────────────────────────────────────────────────────────────

  @Post('invoices')
  @Roles('owner', 'bursar', 'accountant')
  generateInvoice(@Body() dto: GenerateInvoiceDto) {
    return this.feesService.generateInvoice(dto);
  }

  @Get('invoices/:id')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor')
  getInvoice(@Param('id') id: string) {
    return this.feesService.getInvoice(id);
  }

  @Get('invoices/control/:controlNo')
  @Roles('owner', 'bursar', 'accountant')
  getByControlNo(@Param('controlNo') controlNo: string) {
    return this.feesService.getInvoiceByControlNo(controlNo);
  }

  @Get('students/:studentId/invoices')
  @Roles('owner', 'headteacher', 'bursar', 'accountant', 'auditor', 'parent')
  getStudentInvoices(@Param('studentId') studentId: string) {
    return this.feesService.getStudentInvoices(studentId);
  }
}
