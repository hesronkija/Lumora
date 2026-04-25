import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { AcademicService } from './academic.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class CreateAcademicYearDto {
  @IsString() label!: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
}

class CreateTermDto {
  @IsString() academicYearId!: string;
  @IsNumber() @Min(1) @Max(3) termNumber!: number;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
}

class CreateSubjectDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsString() @IsOptional() levelRange?: string;
}

class CreateClassDto {
  @IsString() academicYearId!: string;
  @IsString() level!: string;
  @IsString() @IsOptional() stream?: string;
  @IsString() @IsOptional() classTeacherId?: string;
  @IsNumber() @IsOptional() capacity?: number;
}

class TimetableEntryDto {
  @IsString() subjectId!: string;
  @IsString() teacherId!: string;
  @IsNumber() @Min(1) @Max(5) dayOfWeek!: number;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
}

@ApiTags('academic')
@ApiBearerAuth()
@Controller('academic')
@UseGuards(AuthGuard)
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Post('years')
  @Roles('owner', 'headteacher')
  async createYear(@Body() dto: CreateAcademicYearDto) {
    return this.academicService.createAcademicYear(dto);
  }

  @Get('years/current')
  async getCurrentYear() {
    return this.academicService.getCurrentAcademicYear();
  }

  @Post('terms')
  @Roles('owner', 'headteacher')
  async createTerm(@Body() dto: CreateTermDto) {
    return this.academicService.createTerm(dto);
  }

  @Get('terms/current')
  async getCurrentTerm() {
    return this.academicService.getCurrentTerm();
  }

  @Get('subjects')
  async listSubjects() {
    return this.academicService.listSubjects();
  }

  @Post('subjects')
  @Roles('owner', 'headteacher')
  async createSubject(@Body() dto: CreateSubjectDto) {
    return this.academicService.createSubject(dto);
  }

  @Get('classes')
  async listClasses(@Query('yearId') yearId?: string) {
    return this.academicService.listClasses(yearId);
  }

  @Post('classes')
  @Roles('owner', 'headteacher')
  async createClass(@Body() dto: CreateClassDto) {
    return this.academicService.createClass(dto);
  }

  @Get('classes/:id/roster')
  @Roles('owner', 'headteacher', 'teacher', 'class_teacher', 'bursar')
  async getRoster(@Param('id') id: string, @Query('termId') termId: string) {
    return this.academicService.getClassRoster(id, termId);
  }

  @Get('classes/:id/timetable')
  async getTimetable(@Param('id') id: string) {
    return this.academicService.getTimetable(id);
  }

  @Post('classes/:id/timetable')
  @Roles('owner', 'headteacher')
  async addTimetableEntry(@Param('id') id: string, @Body() dto: TimetableEntryDto) {
    return this.academicService.addTimetableEntry({ classId: id, ...dto });
  }
}
