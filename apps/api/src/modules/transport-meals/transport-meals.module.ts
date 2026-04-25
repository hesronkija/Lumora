import { Module } from '@nestjs/common';
import { TransportMealsService } from './transport-meals.service';
import { TransportMealsController } from './transport-meals.controller';

@Module({
  providers: [TransportMealsService],
  controllers: [TransportMealsController],
  exports: [TransportMealsService],
})
export class TransportMealsModule {}
