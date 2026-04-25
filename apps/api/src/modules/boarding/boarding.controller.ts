import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsUUID, IsDateString, IsInt, IsBoolean } from 'class-validator';
import { BoardingService } from './boarding.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class CreateDormDto {
  @IsUUID() @IsOptional() campusId?: string;
  @IsString() name!: string;
  @IsEnum(['male', 'female', 'mixed']) gender!: 'male' | 'female' | 'mixed';
  @IsInt() capacity!: number;
  @IsString() @IsOptional() matronPatronName?: string;
}

class AssignBedDto {
  @IsUUID() studentId!: string;
  @IsUUID() bedId!: string;
  @IsUUID() termId!: string;
  @IsDateString() assignedFrom!: string;
}

class EndAssignmentDto {
  @IsDateString() assignedTo!: string;
}

class RequestLeaveOutDto {
  @IsUUID() studentId!: string;
  @IsDateString() leaveDate!: string;
  @IsDateString() returnDate!: string;
  @IsString() reason!: string;
  @IsString() guardianName!: string;
  @IsString() guardianPhone!: string;
}

class ReviewLeaveOutDto {
  @IsEnum(['approved', 'rejected']) status!: 'approved' | 'rejected';
  @IsUUID() approvedByUserId!: string;
}

class RecordVisitorDto {
  @IsUUID() studentId!: string;
  @IsString() visitorName!: string;
  @IsString() @IsOptional() visitorPhone?: string;
  @IsString() @IsOptional() relation?: string;
  @IsString() @IsOptional() nationalId?: string;
  @IsString() @IsOptional() purpose?: string;
  @IsUUID() recordedByUserId!: string;
}

class AdmitSickBayDto {
  @IsUUID() studentId!: string;
  @IsString() complaint!: string;
  @IsUUID() attendedByUserId!: string;
}

class UpdateSickBayDto {
  @IsString() @IsOptional() diagnosis?: string;
  @IsString() @IsOptional() treatment?: string;
  @IsString() @IsOptional() medication?: string;
  @IsBoolean() @IsOptional() referredToHospital?: boolean;
  @IsString() @IsOptional() hospitalName?: string;
  @IsBoolean() @IsOptional() guardianNotified?: boolean;
}

@ApiTags('boarding')
@ApiBearerAuth()
@Controller('boarding')
@UseGuards(AuthGuard)
export class BoardingController {
  constructor(private readonly boardingService: BoardingService) {}

  @Get('dashboard')
  @Roles('owner', 'headteacher', 'hr')
  dashboard() {
    return this.boardingService.getBoardingDashboard();
  }

  // ── Dorms ──────────────────────────────────────────────────────────────────

  @Post('dorms')
  @Roles('owner', 'headteacher', 'hr')
  createDorm(@Body() dto: CreateDormDto) {
    return this.boardingService.createDorm(dto);
  }

  @Get('dorms')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  listDorms() {
    return this.boardingService.listDorms();
  }

  @Post('dorms/:dormId/beds')
  @Roles('owner', 'headteacher', 'hr')
  createBed(@Param('dormId') dormId: string, @Body('bedNo') bedNo: string) {
    return this.boardingService.createBed(dormId, bedNo);
  }

  @Get('dorms/:dormId/beds')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  listBeds(@Param('dormId') dormId: string) {
    return this.boardingService.listBeds(dormId);
  }

  // ── Dorm Assignments ───────────────────────────────────────────────────────

  @Post('assignments')
  @Roles('owner', 'headteacher', 'hr')
  assignBed(@Body() dto: AssignBedDto) {
    return this.boardingService.assignBed(dto);
  }

  @Patch('assignments/:id/end')
  @Roles('owner', 'headteacher', 'hr')
  endAssignment(@Param('id') id: string, @Body() dto: EndAssignmentDto) {
    return this.boardingService.endAssignment(id, dto.assignedTo);
  }

  @Get('students/:studentId/status')
  @Roles('owner', 'headteacher', 'hr', 'parent', 'auditor')
  studentStatus(@Param('studentId') studentId: string) {
    return this.boardingService.getStudentBoardingStatus(studentId);
  }

  // ── Leave-Out ──────────────────────────────────────────────────────────────

  @Post('leave-outs')
  @Roles('owner', 'headteacher', 'hr', 'parent')
  requestLeaveOut(@Body() dto: RequestLeaveOutDto) {
    return this.boardingService.requestLeaveOut(dto);
  }

  @Get('leave-outs')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  listLeaveOuts(@Query('status') status?: string, @Query('studentId') studentId?: string) {
    return this.boardingService.listLeaveOuts(status, studentId);
  }

  @Patch('leave-outs/:id/review')
  @Roles('owner', 'headteacher', 'hr')
  reviewLeaveOut(@Param('id') id: string, @Body() dto: ReviewLeaveOutDto) {
    return this.boardingService.reviewLeaveOut(id, dto.status, dto.approvedByUserId);
  }

  @Patch('leave-outs/:id/returned')
  @Roles('owner', 'headteacher', 'hr')
  recordReturn(@Param('id') id: string) {
    return this.boardingService.recordReturn(id);
  }

  // ── Visitors ───────────────────────────────────────────────────────────────

  @Post('visitors')
  @Roles('owner', 'headteacher', 'hr')
  recordVisitor(@Body() dto: RecordVisitorDto) {
    return this.boardingService.recordVisitor(dto);
  }

  @Get('visitors')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  listVisitors(@Query('date') date?: string, @Query('studentId') studentId?: string) {
    return this.boardingService.listVisitors(date, studentId);
  }

  @Patch('visitors/:id/checkout')
  @Roles('owner', 'headteacher', 'hr')
  checkOutVisitor(@Param('id') id: string) {
    return this.boardingService.checkOutVisitor(id);
  }

  // ── Sick Bay ───────────────────────────────────────────────────────────────

  @Post('sickbay')
  @Roles('owner', 'headteacher', 'hr')
  admitSickBay(@Body() dto: AdmitSickBayDto) {
    return this.boardingService.admitToSickBay(dto);
  }

  @Get('sickbay')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  listSickBay(@Query('active') active?: string) {
    return this.boardingService.listSickBayVisits(active === 'true');
  }

  @Patch('sickbay/:id')
  @Roles('owner', 'headteacher', 'hr')
  updateSickBay(@Param('id') id: string, @Body() dto: UpdateSickBayDto) {
    return this.boardingService.updateSickBayVisit(id, dto);
  }

  @Patch('sickbay/:id/discharge')
  @Roles('owner', 'headteacher', 'hr')
  dischargeSickBay(@Param('id') id: string) {
    return this.boardingService.dischargeSickBay(id);
  }
}
