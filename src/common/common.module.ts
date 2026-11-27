import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { GlobalValidationPipe } from './pipes/global-validation.pipe.js';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: GlobalValidationPipe,
    },
  ],
})
export class CommonModule {}
