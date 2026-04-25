import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  providers: [PayrollService],
  controllers: [PayrollController],
  exports: [PayrollService],
})
export class PayrollModule {}
