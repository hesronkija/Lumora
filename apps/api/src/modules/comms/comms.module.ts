import { Module } from '@nestjs/common';
import { CommsService } from './comms.service';
import { CommsController } from './comms.controller';
import { BeemAdapter } from './adapters/beem.adapter';
import { SesAdapter } from './adapters/ses.adapter';

@Module({
  providers: [CommsService, BeemAdapter, SesAdapter],
  controllers: [CommsController],
  exports: [CommsService],
})
export class CommsModule {}
