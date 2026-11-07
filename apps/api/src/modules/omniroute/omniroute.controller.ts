import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { OmniRouteService, CompletionRequest } from './omniroute.service';

@Controller('omniroute')
export class OmniRouteController {
  constructor(private readonly omniService: OmniRouteService) {}

  @Get('health')
  async checkHealth() {
    return this.omniService.checkHealth();
  }

  @Get('models')
  async getAllowedModels() {
    return this.omniService.getAllowedModels();
  }

  @Post('models/sync-free')
  async syncFreeModels() {
    return this.omniService.syncFreeModelsFromOmniRoute();
  }

  @Get('squad')
  async getSquadSpecialists() {
    return this.omniService.getSpecialistConfigs();
  }

  @Put('squad/:role')
  async updateSpecialist(
    @Param('role') role: string,
    @Body()
    body: {
      primaryModel?: string;
      fallbackModel?: string;
      temperature?: number;
      customSystemPrompt?: string;
    }
  ) {
    return this.omniService.updateSpecialistConfig(role, body);
  }

  @Post('chat')
  async testChat(@Body() body: CompletionRequest) {
    return this.omniService.generateCompletion(body);
  }
}
