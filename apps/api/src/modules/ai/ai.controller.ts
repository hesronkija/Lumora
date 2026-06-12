import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsIn, MaxLength } from 'class-validator';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';
import { TenantStorage } from '@lumora/shared-tenancy';
import { AiService, type Locale } from './ai.service';

class ReportCommentDto {
  @IsString() studentName!: string;
  @IsString() admissionNo!: string;
  @IsString() subjectName!: string;
  @IsNumber() score!: number;
  @IsNumber() maxScore!: number;
  @IsNumber() percentage!: number;
  @IsNumber() positionInClass!: number;
  @IsNumber() classSize!: number;
  @IsString() grade!: string;
  @IsNumber() @IsOptional() previousTermPercentage?: number;
  @IsIn(['en-TZ', 'sw-TZ']) @IsOptional() locale?: Locale;
}

class AnnouncementDto {
  @IsString() @MaxLength(500) intent!: string;
  @IsIn(['sms', 'whatsapp', 'email']) channel!: 'sms' | 'whatsapp' | 'email';
  @IsIn(['en-TZ', 'sw-TZ']) @IsOptional() locale?: Locale;
  @IsNumber() @IsOptional() maxLength?: number;
  @IsString() tenantName!: string;
}

class ParentChatDto {
  @IsString() @MaxLength(1000) question!: string;
  @IsIn(['en-TZ', 'sw-TZ']) @IsOptional() locale?: Locale;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Draft a report-card comment. Teacher edits + approves before it ships. */
  @Post('report-comment')
  @Roles('teacher', 'class_teacher', 'headteacher', 'owner')
  draftComment(@Body() dto: ReportCommentDto) {
    const { locale, ...perf } = dto;
    return this.ai.draftReportComment(perf, locale ?? 'en-TZ');
  }

  /** Draft a parent announcement. Human edits + sends — never auto-dispatched. */
  @Post('announcement')
  @Roles('headteacher', 'owner')
  draftAnnouncement(@Body() dto: AnnouncementDto) {
    return this.ai.draftAnnouncement({ ...dto, locale: dto.locale ?? 'en-TZ' });
  }

  /** Bilingual parent assistant grounded ONLY in the asking parent's children. */
  @Post('parent-chat')
  @Roles('parent')
  parentChat(@Body() dto: ParentChatDto) {
    const { userId } = TenantStorage.get();
    return this.ai.parentChat(dto.question, userId, dto.locale ?? 'en-TZ');
  }
}
