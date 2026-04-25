import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ExamsService } from './exams.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class CreateExamDto {
  @IsString() termId!: string;
  @IsString() classId!: string;
  @IsString() name!: string;
  @IsEnum(['cat', 'mid_term', 'end_of_term', 'mock', 'assessment'])
  examType!: 'cat' | 'mid_term' | 'end_of_term' | 'mock' | 'assessment';
  @IsString() @IsOptional() examDate?: string;
  @IsNumber() @IsOptional() totalMarks?: number;
}

class ScoreEntryDto {
  @IsString() studentId!: string;
  @IsString() subjectId!: string;
  @IsNumber() marksObtained!: number;
  @IsString() @IsOptional() teacherComment?: string;
}

class EnterScoresDto {
  @IsString() enteredBy!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ScoreEntryDto)
  scores!: ScoreEntryDto[];
}

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
@UseGuards(AuthGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @Roles('owner', 'headteacher', 'teacher')
  async create(@Body() dto: CreateExamDto) {
    return this.examsService.createExam(dto);
  }

  @Post(':id/scores')
  @Roles('teacher', 'class_teacher', 'headteacher')
  async enterScores(@Param('id') id: string, @Body() dto: EnterScoresDto) {
    return this.examsService.enterScores(id, dto.enteredBy, dto.scores);
  }

  @Post('report-cards/generate')
  @Roles('owner', 'headteacher')
  async generateReportCards(@Body() body: { termId: string; classId: string }) {
    return this.examsService.generateReportCards(body.termId, body.classId);
  }

  @Post('report-cards/publish')
  @Roles('owner', 'headteacher')
  async publishReportCards(@Body() body: { termId: string; classId: string }) {
    await this.examsService.publishReportCards(body.termId, body.classId);
    return { success: true };
  }

  @Get('report-cards/:studentId')
  async getReportCard(
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    return this.examsService.getReportCard(studentId, termId);
  }
}
