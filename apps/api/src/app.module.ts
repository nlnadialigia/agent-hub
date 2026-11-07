import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { VaultModule } from './modules/vault/vault.module';
import { OmniRouteModule } from './modules/omniroute/omniroute.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { RepositoryModule } from './modules/repository/repository.module';
import { SquadModule } from './modules/squad/squad.module';

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
    GatewayModule,
    RepositoryModule,
    SquadModule,
  ],
})
export class AppModule {}
