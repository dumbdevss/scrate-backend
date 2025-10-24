import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HederaModule } from './hedera/hedera.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HederaModule,
  ],
})
export class AppModule {}
