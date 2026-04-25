import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsDateString, IsEnum, IsEmail, IsOptional } from 'class-validator';
import { AdmissionsService } from './admissions.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class CreateApplicationDto {
  @IsString() applicantName!: string;
  @IsDateString() applicantDob!: string;
  @IsEnum(['male', 'female', 'other']) applicantGender!: 'male' | 'female' | 'other';
  @IsString() guardianName!: string;
  @IsString() guardianPhone!: string;
  @IsEmail() @IsOptional() guardianEmail?: string;
  @IsString() applyingForClass!: string;
  @IsString() academicYear!: string;
}

class ReviewDto {
  @IsEnum(['offered', 'rejected']) status!: 'offered' | 'rejected';
  @IsString() reviewedBy!: string;
  @IsString() @IsOptional() rejectionReason?: string;
}

class EnrollDto {
  @IsString() classId!: string;
  @IsString() termId!: string;
  @IsString() admissionNo!: string;
}

@ApiTags('admissions')
@ApiBearerAuth()
@Controller('admissions')
@UseGuards(AuthGuard)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Post()
  @Roles('owner', 'headteacher', 'hr')
  async create(@Body() dto: CreateApplicationDto) {
    return this.admissionsService.createApplication(dto);
  }

  @Get()
  @Roles('owner', 'headteacher', 'hr')
  async list(@Query('status') status?: string) {
    return this.admissionsService.listApplications(status);
  }

  @Get(':id')
  @Roles('owner', 'headteacher', 'hr')
  async get(@Param('id') id: string) {
    return this.admissionsService.getApplication(id);
  }

  @Patch(':id/submit')
  async submit(@Param('id') id: string) {
    return this.admissionsService.submitApplication(id);
  }

  @Patch(':id/review')
  @Roles('owner', 'headteacher')
  async review(@Param('id') id: string, @Body() dto: ReviewDto) {
    return this.admissionsService.reviewApplication({ applicationId: id, ...dto });
  }

  @Post(':id/enroll')
  @Roles('owner', 'headteacher', 'hr')
  async enroll(@Param('id') id: string, @Body() dto: EnrollDto) {
    return this.admissionsService.enrollFromApplication({ applicationId: id, ...dto });
  }
}
