import { Injectable } from '@nestjs/common';
import { ITaskProvider, TaskCard } from './task-provider.interface';

@Injectable()
export class ManualProvider implements ITaskProvider {
  readonly providerType = 'MANUAL';

  async fetchTask(cardId: string, _config: Record<string, string>): Promise<TaskCard> {
    return {
      cardId: cardId || `MANUAL-${Date.now()}`,
      title: cardId.startsWith('MANUAL-') ? 'Demanda Manual' : cardId,
      description: 'Demanda inserida diretamente pelo usuário sem vínculo com card externo.',
      tags: ['manual'],
    };
  }

  async testConnection(_config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    return {
      ok: true,
      message: 'Provedor Manual sempre disponível para prompts diretos.',
    };
  }
}
