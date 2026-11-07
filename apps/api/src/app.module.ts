import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { VaultModule } from './modules/vault/vault.module';
import { OmniRouteModule } from './modules/omniroute/omniroute.module';
import { ProvidersModule } from './modules/providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    VaultModule,
    OmniRouteModule,
    ProvidersModule,
  ],
})
export class AppModule {}
