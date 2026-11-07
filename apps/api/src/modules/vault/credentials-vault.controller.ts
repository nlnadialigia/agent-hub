import { Controller, Get, Post, Delete, Body, Param, HttpStatus, HttpException } from '@nestjs/common';
import { CredentialsVaultService } from './credentials-vault.service';

@Controller('vault')
export class CredentialsVaultController {
  constructor(private readonly vaultService: CredentialsVaultService) {}

  @Get('connections')
  async listConnections() {
    return this.vaultService.listConnections();
  }

  @Post('connections')
  async saveConnection(
    @Body()
    body: {
      category: 'TASK_PROVIDER' | 'VCS_PROVIDER' | 'LLM_PROVIDER';
      providerType: string;
      name: string;
      config: Record<string, any>;
      isDefault?: boolean;
    }
  ) {
    if (!body.category || !body.providerType || !body.name || !body.config) {
      throw new HttpException('Dados incompletos para salvar conexão', HttpStatus.BAD_REQUEST);
    }
    return this.vaultService.saveConnection(body);
  }

  @Delete('connections/:id')
  async deleteConnection(@Param('id') id: string) {
    return this.vaultService.deleteConnection(id);
  }
}
