import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsOptional, IsUUID, IsInt, IsNumberString, IsArray, IsNumber,
} from 'class-validator';
import { TransportMealsService } from './transport-meals.service';
import { AuthGuard, Roles } from '../../common/guards/auth.guard';

class CreateBusDto {
  @IsString() registrationNo!: string;
  @IsString() @IsOptional() makeModel?: string;
  @IsInt() capacity!: number;
}

class CreateRouteDto {
  @IsUUID() @IsOptional() busId?: string;
  @IsUUID() @IsOptional() driverStaffId?: string;
  @IsString() name!: string;
  @IsEnum(['inbound', 'outbound', 'both']) direction!: 'inbound' | 'outbound' | 'both';
  @IsString() @IsOptional() departureTime?: string;
  @IsNumberString() monthlyFee!: string;
  @IsNumberString() termFee!: string;
}

class AddPickupPointDto {
  @IsString() name!: string;
  @IsInt() stopOrder!: number;
  @IsString() @IsOptional() estimatedTime?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
}

class AssignRouteDto {
  @IsUUID() studentId!: string;
  @IsUUID() routeId!: string;
  @IsUUID() @IsOptional() pickupPointId?: string;
  @IsUUID() termId!: string;
}

class CreateMealPlanDto {
  @IsString() name!: string;
  @IsArray() mealTypes!: string[];
  @IsNumberString() dailyRate!: string;
  @IsNumberString() termRate!: string;
}

class TopUpDto {
  @IsUUID() studentId!: string;
  @IsNumberString() amount!: string;
  @IsUUID() recordedByUserId!: string;
}

class RecordMealDto {
  @IsUUID() studentId!: string;
  @IsEnum(['breakfast', 'lunch', 'dinner', 'morning_tea', 'afternoon_tea'])
  mealType!: string;
  @IsUUID() recordedByUserId!: string;
}

@ApiTags('transport-meals')
@ApiBearerAuth()
@Controller('transport-meals')
@UseGuards(AuthGuard)
export class TransportMealsController {
  constructor(private readonly service: TransportMealsService) {}

  @Get('transport/dashboard')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  transportDashboard() {
    return this.service.getTransportDashboard();
  }

  // ── Buses ──────────────────────────────────────────────────────────────────

  @Post('buses')
  @Roles('owner', 'headteacher', 'hr')
  createBus(@Body() dto: CreateBusDto) {
    return this.service.createBus(dto);
  }

  @Get('buses')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  listBuses() {
    return this.service.listBuses();
  }

  // ── Routes ─────────────────────────────────────────────────────────────────

  @Post('routes')
  @Roles('owner', 'headteacher', 'hr')
  createRoute(@Body() dto: CreateRouteDto) {
    return this.service.createRoute(dto);
  }

  @Get('routes')
  @Roles('owner', 'headteacher', 'hr', 'parent', 'auditor')
  listRoutes() {
    return this.service.listRoutes();
  }

  @Post('routes/:routeId/pickup-points')
  @Roles('owner', 'headteacher', 'hr')
  addPickupPoint(@Param('routeId') routeId: string, @Body() dto: AddPickupPointDto) {
    return this.service.addPickupPoint(routeId, dto);
  }

  @Get('routes/:routeId/pickup-points')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  listPickupPoints(@Param('routeId') routeId: string) {
    return this.service.listPickupPoints(routeId);
  }

  @Get('routes/:routeId/manifest')
  @Roles('owner', 'headteacher', 'hr', 'auditor')
  routeManifest(@Param('routeId') routeId: string, @Query('termId') termId: string) {
    return this.service.getRouteManifest(routeId, termId);
  }

  // ── Route Assignments ──────────────────────────────────────────────────────

  @Post('route-assignments')
  @Roles('owner', 'headteacher', 'hr')
  assignRoute(@Body() dto: AssignRouteDto) {
    return this.service.assignStudentToRoute(dto);
  }

  @Delete('route-assignments/:id')
  @Roles('owner', 'headteacher', 'hr')
  removeRoute(@Param('id') id: string) {
    return this.service.removeStudentFromRoute(id);
  }

  // ── Meal Plans ─────────────────────────────────────────────────────────────

  @Post('meal-plans')
  @Roles('owner', 'headteacher', 'bursar')
  createMealPlan(@Body() dto: CreateMealPlanDto) {
    return this.service.createMealPlan(dto);
  }

  @Get('meal-plans')
  @Roles('owner', 'headteacher', 'bursar', 'auditor')
  listMealPlans() {
    return this.service.listMealPlans();
  }

  // ── Canteen Wallets ────────────────────────────────────────────────────────

  @Get('wallets/:studentId')
  @Roles('owner', 'headteacher', 'bursar', 'parent', 'auditor')
  getWallet(@Param('studentId') studentId: string) {
    return this.service.getWallet(studentId);
  }

  @Post('wallets/topup')
  @Roles('owner', 'bursar', 'accountant')
  topUp(@Body() dto: TopUpDto) {
    return this.service.topUpWallet(dto.studentId, dto.amount, dto.recordedByUserId);
  }

  @Post('wallets/meal')
  @Roles('owner', 'headteacher', 'hr')
  recordMeal(@Body() dto: RecordMealDto) {
    return this.service.recordMeal(dto.studentId, dto.mealType, dto.recordedByUserId);
  }

  @Get('wallets/:studentId/transactions')
  @Roles('owner', 'headteacher', 'bursar', 'parent', 'auditor')
  walletTransactions(@Param('studentId') studentId: string, @Query('limit') limit?: number) {
    return this.service.getWalletTransactions(studentId, limit ? +limit : 50);
  }

  @Get('meals/daily-report')
  @Roles('owner', 'headteacher', 'bursar', 'auditor')
  dailyReport(@Query('date') date: string) {
    return this.service.getDailyMealReport(date);
  }
}
