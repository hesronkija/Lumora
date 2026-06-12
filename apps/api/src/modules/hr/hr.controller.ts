import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsIn, IsArray, IsNumberString } from 'class-validator';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';
import { HrService, type CreateStaffDto, type UpdateStaffDto } from './hr.service';

class StaffDto implements CreateStaffDto {
  @IsString() employeeNo!: string;
  @IsString() legalName!: string;
  @IsIn(['male', 'female']) gender!: 'male' | 'female';
  @IsString() @IsOptional() dob?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() tin?: string;
  @IsString() @IsOptional() nida?: string;
  @IsString() @IsOptional() tscNumber?: string;
  @IsString() @IsOptional() nssfNumber?: string;
  @IsString() @IsOptional() nhifNumber?: string;
  @IsBoolean() @IsOptional() hasHeslbLoan?: boolean;
  @IsIn(['nssf', 'psssf', 'none']) @IsOptional() pensionFund?: 'nssf' | 'psssf' | 'none';
  @IsIn(['permanent', 'contract', 'part_time', 'volunteer', 'tsc_seconded']) @IsOptional()
  contractType?: 'permanent' | 'contract' | 'part_time' | 'volunteer' | 'tsc_seconded';
  @IsString() position!: string;
  @IsString() @IsOptional() department?: string;
  @IsNumberString() @IsOptional() basicSalary?: string;
  @IsArray() @IsOptional() allowances?: Array<{ code: string; label: string; amount: string }>;
  @IsString() @IsOptional() bankName?: string;
  @IsString() @IsOptional() bankAccount?: string;
  @IsString() @IsOptional() mobileNumber?: string;
  @IsIn(['bank', 'mobile_money', 'cash']) @IsOptional() disbursementMethod?: 'bank' | 'mobile_money' | 'cash';
  @IsString() @IsOptional() employmentStart?: string;
  @IsArray() @IsOptional() qualifications?: Array<{ award: string; institution: string; year: number }>;
}

@ApiTags('hr')
@ApiBearerAuth()
@Controller('hr/staff')
@UseGuards(AuthGuard)
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Post()
  @Roles('owner', 'headteacher', 'hr')
  create(@Body() dto: StaffDto) {
    return this.hr.createStaff(dto);
  }

  @Get()
  @Roles('owner', 'headteacher', 'hr', 'bursar', 'accountant', 'auditor')
  list(
    @Query('q') q?: string,
    @Query('department') department?: string,
    @Query('active') active?: string,
  ) {
    return this.hr.listStaff({
      ...(q ? { q } : {}),
      ...(department ? { department } : {}),
      ...(active !== undefined ? { active: active !== 'false' } : {}),
    });
  }

  @Get(':id')
  @Roles('owner', 'headteacher', 'hr', 'bursar', 'accountant', 'auditor')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.hr.getStaff(id);
  }

  @Patch(':id')
  @Roles('owner', 'headteacher', 'hr')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<StaffDto>) {
    return this.hr.updateStaff(id, dto as UpdateStaffDto);
  }

  @Patch(':id/deactivate')
  @Roles('owner', 'headteacher', 'hr')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Body() body: { endDate?: string }) {
    return this.hr.deactivateStaff(id, body?.endDate);
  }
}
