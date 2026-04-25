import { Module } from '@nestjs/common';
import { AcademicService } from './academic.service';
import { AcademicController } from './academic.controller';

@Module({
  providers: [AcademicService],
  controllers: [AcademicController],
  exports: [AcademicService],
})
export class AcademicModule {}
