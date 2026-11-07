import { Module } from '@nestjs/common';
import { OmniRouteService } from './omniroute.service';
import { OmniRouteController } from './omniroute.controller';
import { VaultModule } from '../vault/vault.module';

@Module({
  imports: [VaultModule],
  controllers: [OmniRouteController],
  providers: [OmniRouteService],
  exports: [OmniRouteService],
})
export class OmniRouteModule {}
