import { Controller, Get, Put, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsEmail, IsOptional, IsBoolean } from 'class-validator';
import { StudentsService } from './students.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class UpdateStudentDto {
  @IsString() @IsOptional() legalName?: string;
  @IsString() @IsOptional() medicalNotes?: string;
  @IsString() @IsOptional() photoKey?: string;
}

class AddGuardianDto {
  @IsString() legalName!: string;
  @IsString() phone!: string;
  @IsString() @IsOptional() phoneAlt?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsEnum(['father', 'mother', 'guardian', 'sibling', 'other'])
  relation!: 'father' | 'mother' | 'guardian' | 'sibling' | 'other';
  @IsString() @IsOptional() nida?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsBoolean() @IsOptional() canPickup?: boolean;
  @IsBoolean() @IsOptional() finResponsible?: boolean;
}

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
@UseGuards(AuthGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('search')
  @Roles('owner', 'headteacher', 'teacher', 'class_teacher', 'bursar', 'hr')
  async search(@Query('q') q: string) {
    return this.studentsService.search(q);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.studentsService.findById(id);
  }

  @Put(':id')
  @Roles('owner', 'headteacher', 'hr')
  async update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Post(':id/guardians')
  @Roles('owner', 'headteacher', 'hr')
  async addGuardian(@Param('id') id: string, @Body() dto: AddGuardianDto) {
    return this.studentsService.addGuardian(id, dto);
  }

  @Get(':id/enrollments')
  async getEnrollments(@Param('id') id: string) {
    return this.studentsService.getCurrentEnrollments(id);
  }
}
