import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import appConfig from './config/app.config.js';
import observeConfig from './config/observe.config.js';
import { CommonModule } from './common/common.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, observeConfig],
    }),
    ObserveModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        appKey: config.get<string>('observe.appKey'),
        appSecret: config.get<string>('observe.appSecret'),
        serviceId: config.getOrThrow<string>('observe.serviceId'),
      }),
    }),
    CommonModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
