import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { IdentityModule } from './modules/identity/identity.module';
import { AuditModule } from './modules/audit/audit.module';
import { CommsModule } from './modules/comms/comms.module';
import { HealthModule } from './modules/health/health.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { StudentsModule } from './modules/students/students.module';
import { AcademicModule } from './modules/academic/academic.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExamsModule } from './modules/exams/exams.module';
import { FeesModule } from './modules/fees/fees.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { BoardingModule } from './modules/boarding/boarding.module';
import { TransportMealsModule } from './modules/transport-meals/transport-meals.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    DatabaseModule,
    // Phase 0
    TenancyModule,
    IdentityModule,
    AuditModule,
    CommsModule,
    HealthModule,
    // Phase 1
    AdmissionsModule,
    StudentsModule,
    AcademicModule,
    AttendanceModule,
    ExamsModule,
    // Phase 2
    FeesModule,
    PaymentsModule,
    // Phase 3
    AccountingModule,
    PayrollModule,
    // Phase 4
    BoardingModule,
    TransportMealsModule,
    // Phase 5
    ReportingModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware, TenantResolverMiddleware).forRoutes('*');
  }
}
