import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { ReconciliationService } from './reconciliation.service';
import { SelcomAdapter } from './adapters/selcom.adapter';
import { GepgAdapter } from './adapters/gepg.adapter';
import { CashAdapter } from './adapters/cash.adapter';
import { VfmsAdapter } from './adapters/vfms.adapter';
import { FeesModule } from '../fees/fees.module';

@Module({
  imports: [FeesModule],
  providers: [
    PaymentsService,
    ReconciliationService,
    SelcomAdapter,
    GepgAdapter,
    CashAdapter,
    VfmsAdapter,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, ReconciliationService],
})
export class PaymentsModule {}
