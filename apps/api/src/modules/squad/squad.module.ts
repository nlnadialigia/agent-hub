import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { RepositoryModule } from '../repository/repository.module';
import { ProvidersModule } from '../providers/providers.module';
import { OmniRouteModule } from '../omniroute/omniroute.module';
import { OrchestratorAgent } from './orchestrator.agent';
import { SpecialistAgentsService } from './specialist.agents';
import { SquadRunnerService } from './squad-runner.service';
import { SquadController } from './squad.controller';

@Module({
  imports: [GatewayModule, RepositoryModule, ProvidersModule, OmniRouteModule],
  controllers: [SquadController],
  providers: [OrchestratorAgent, SpecialistAgentsService, SquadRunnerService],
  exports: [OrchestratorAgent, SpecialistAgentsService, SquadRunnerService],
})
export class SquadModule {}
