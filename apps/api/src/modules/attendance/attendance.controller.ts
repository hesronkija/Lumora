import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsArray, IsEnum, IsOptional, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceService } from './attendance.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class AttendanceRecordDto {
  @IsString() studentId!: string;
  @IsEnum(['present', 'absent', 'late', 'excused']) status!: 'present' | 'absent' | 'late' | 'excused';
  @IsString() @IsOptional() notes?: string;
}

class TakeAttendanceDto {
  @IsString() classId!: string;
  @IsString() termId!: string;
  @IsString() date!: string;
  @IsEnum(['morning', 'afternoon', 'full_day']) @IsOptional() sessionType?: 'morning' | 'afternoon' | 'full_day';
  @IsString() takenBy!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records!: AttendanceRecordDto[];
}

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(AuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @Roles('teacher', 'class_teacher', 'headteacher', 'owner')
  async take(@Body() dto: TakeAttendanceDto) {
    return this.attendanceService.takeAttendance(dto);
  }

  @Get('class/:classId')
  @Roles('teacher', 'class_teacher', 'headteacher', 'owner')
  async getClassAttendance(@Param('classId') classId: string, @Query('date') date: string) {
    return this.attendanceService.getClassAttendance(classId, date);
  }

  @Get('student/:studentId/summary')
  async getStudentSummary(
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    return this.attendanceService.getAttendanceSummary(studentId, termId);
  }
}
