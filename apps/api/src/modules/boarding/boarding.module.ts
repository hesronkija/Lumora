import { Module } from '@nestjs/common';
import { BoardingService } from './boarding.service';
import { BoardingController } from './boarding.controller';

@Module({
  providers: [BoardingService],
  controllers: [BoardingController],
  exports: [BoardingService],
})
export class BoardingModule {}
