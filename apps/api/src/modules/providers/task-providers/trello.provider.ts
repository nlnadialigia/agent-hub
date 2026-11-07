import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ITaskProvider, TaskCard } from './task-provider.interface';

@Injectable()
export class TrelloProvider implements ITaskProvider {
  readonly providerType = 'TRELLO';

  async fetchTask(cardId: string, config: Record<string, string>): Promise<TaskCard> {
    const key = config.apiKey || process.env.TRELLO_API_KEY;
    const token = config.token || process.env.TRELLO_TOKEN;

    if (!key || !token) {
      return {
        cardId,
        title: `Trello Card ${cardId}`,
        description: `Implementar demanda do Trello ${cardId}.`,
        tags: ['trello'],
      };
    }

    try {
      const res = await axios.get(`https://api.trello.com/1/cards/${cardId}?key=${key}&token=${token}`, {
        timeout: 8000,
      });
      return {
        cardId,
        title: res.data.name || `Trello Card ${cardId}`,
        description: res.data.desc || '',
        tags: (res.data.labels || []).map((l: any) => l.name),
      };
    } catch {
      return {
        cardId,
        title: `Trello Card ${cardId}`,
        description: `Implementar demanda do Trello ${cardId}.`,
        tags: ['trello'],
      };
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const key = config.apiKey || process.env.TRELLO_API_KEY;
    const token = config.token || process.env.TRELLO_TOKEN;

    if (!key || !token) {
      return { ok: false, message: 'API Key e Token do Trello são obrigatórios.' };
    }

    try {
      const res = await axios.get(`https://api.trello.com/1/members/me?key=${key}&token=${token}`, {
        timeout: 6000,
      });
      return {
        ok: true,
        message: `Conexão bem-sucedida com Trello! Usuário: ${res.data?.fullName || res.data?.username}.`,
      };
    } catch (error: any) {
      return { ok: false, message: `Falha na conexão com Trello: ${error.message}` };
    }
  }
}
