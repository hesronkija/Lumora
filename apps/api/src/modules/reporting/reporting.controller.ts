import { Controller, Get, Post, Put, Param, Body, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsArray, IsInt, IsBoolean } from 'class-validator';
import type { Response } from 'express';
import { ReportingService } from './reporting.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class TimetableSlotDto {
  @IsUUID() classId!: string;
  @IsUUID() subjectId!: string;
  @IsUUID() @IsOptional() teacherStaffId?: string;
  @IsUUID() termId!: string;
  @IsString() dayOfWeek!: string;
  @IsInt() periodNumber!: number;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsString() @IsOptional() room?: string;
  @IsBoolean() @IsOptional() aiGenerated?: boolean;
}

@ApiTags('reporting')
@ApiBearerAuth()
@Controller('reporting')
@UseGuards(AuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  // ── NECTA ──────────────────────────────────────────────────────────────────

  @Get('necta/candidates')
  @Roles('owner', 'headteacher', 'auditor')
  async nectaCandidates(
    @Query('termId') termId: string,
    @Query('classIds') classIds?: string,
    @Res() res: Response = null as unknown as Response,
  ) {
    const result = await this.reportingService.nectaCandidateExport(
      termId,
      classIds ? classIds.split(',') : undefined,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.content);
  }

  // ── BEMIS ──────────────────────────────────────────────────────────────────

  @Get('bemis/enrollment')
  @Roles('owner', 'headteacher', 'auditor')
  bemisEnrollment(@Query('academicYearId') academicYearId: string) {
    return this.reportingService.bemisEnrollmentExport(academicYearId);
  }

  // ── Inspector ──────────────────────────────────────────────────────────────

  @Get('inspector/summary')
  @Roles('owner', 'headteacher', 'auditor')
  inspectorSummary(@Query('from') from: string, @Query('to') to: string) {
    return this.reportingService.inspectorExport(from, to);
  }

  // ── At-Risk ────────────────────────────────────────────────────────────────

  @Get('at-risk')
  @Roles('owner', 'headteacher')
  atRisk(@Query('termId') termId: string) {
    return this.reportingService.atRiskReport(termId);
  }

  // ── Timetable ──────────────────────────────────────────────────────────────

  @Get('timetable')
  @Roles('owner', 'headteacher', 'teacher', 'class_teacher', 'parent', 'student', 'auditor')
  getTimetable(@Query('classId') classId: string, @Query('termId') termId: string) {
    return this.reportingService.getTimetable(classId, termId);
  }

  @Put('timetable/slot')
  @Roles('owner', 'headteacher')
  upsertSlot(@Body() dto: TimetableSlotDto) {
    return this.reportingService.upsertTimetableSlot(dto);
  }
}
