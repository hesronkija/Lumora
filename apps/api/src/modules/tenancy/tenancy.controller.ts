import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MinLength, Matches } from 'class-validator';
import { TenancyService } from './tenancy.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class CreateTenantDto {
  @IsString() @MinLength(2)
  name!: string;

  @IsEnum(['public_primary', 'private', 'international'])
  kind!: 'public_primary' | 'private' | 'international';

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'subdomain must be lowercase alphanumeric with hyphens' })
  subdomain!: string;

  @IsString() @IsOptional()
  registrationNo?: string;

  @IsString() @IsOptional()
  vrn?: string;
}

@ApiTags('tenancy')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(AuthGuard)
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Post()
  @Roles('owner')
  async provision(@Body() dto: CreateTenantDto) {
    return this.tenancyService.provision(dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.tenancyService.findById(id);
  }
}
