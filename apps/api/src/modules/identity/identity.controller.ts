import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsObject } from 'class-validator';
import { IdentityService } from './identity.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString() @IsOptional()
  phone?: string;

  @IsString() @IsOptional()
  locale?: string;

  @IsString() @IsOptional()
  keycloakId?: string;
}

class AssignRoleDto {
  @IsString()
  roleCode!: string;

  @IsObject() @IsOptional()
  scopeJson?: Record<string, unknown>;
}

@ApiTags('identity')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post()
  @Roles('owner', 'headteacher', 'hr')
  async createUser(@Body() dto: CreateUserDto) {
    return this.identityService.createUser(dto);
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.identityService.getUserProfile(id);
  }

  @Post(':id/roles')
  @Roles('owner', 'headteacher')
  async assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    await this.identityService.assignRole({ userId: id, ...dto });
    return { success: true };
  }
}
