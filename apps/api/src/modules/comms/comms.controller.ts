import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { CommsService } from './comms.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class SendMessageDto {
  @IsString()
  recipientRef!: string;

  @IsEnum(['sms', 'whatsapp', 'email', 'push'])
  channel!: 'sms' | 'whatsapp' | 'email' | 'push';

  @IsString()
  templateKey!: string;

  @IsString() @IsOptional()
  locale?: string;

  @IsObject() @IsOptional()
  vars?: Record<string, unknown>;
}

class ConsentDto {
  @IsString()
  subjectRef!: string;

  @IsEnum(['sms', 'whatsapp', 'email', 'push'])
  channel!: 'sms' | 'whatsapp' | 'email' | 'push';

  @IsEnum(['opted_in', 'opted_out'])
  status!: 'opted_in' | 'opted_out';

  @IsString()
  evidence!: string;
}

@ApiTags('comms')
@ApiBearerAuth()
@Controller('comms')
@UseGuards(AuthGuard)
export class CommsController {
  constructor(private readonly commsService: CommsService) {}

  @Post('send')
  @Roles('owner', 'headteacher', 'bursar', 'hr', 'teacher', 'class_teacher')
  async send(@Body() dto: SendMessageDto) {
    return this.commsService.send(dto);
  }

  @Post('consent')
  async recordConsent(@Body() dto: ConsentDto) {
    await this.commsService.recordConsent(
      dto.subjectRef,
      dto.channel,
      dto.status,
      dto.evidence,
    );
    return { success: true };
  }
}
