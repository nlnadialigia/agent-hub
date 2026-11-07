import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ITaskProvider, TaskCard } from './task-provider.interface';

@Injectable()
export class LinearProvider implements ITaskProvider {
  readonly providerType = 'LINEAR';

  async fetchTask(cardId: string, config: Record<string, string>): Promise<TaskCard> {
    const apiKey = config.apiKey || process.env.LINEAR_API_KEY;

    if (!apiKey) {
      return {
        cardId,
        title: `Linear Issue ${cardId}`,
        description: `Implementar issue do Linear ${cardId}.`,
        tags: ['linear'],
      };
    }

    try {
      const query = `
        query {
          issue(id: "${cardId}") {
            id
            identifier
            title
            description
            labels { nodes { name } }
          }
        }
      `;

      const res = await axios.post(
        'https://api.linear.app/graphql',
        { query },
        {
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        }
      );

      const issue = res.data?.data?.issue;
      return {
        cardId: issue?.identifier || cardId,
        title: issue?.title || `Linear ${cardId}`,
        description: issue?.description || '',
        tags: (issue?.labels?.nodes || []).map((l: any) => l.name),
      };
    } catch {
      return {
        cardId,
        title: `Linear Issue ${cardId}`,
        description: `Implementar issue do Linear ${cardId}.`,
        tags: ['linear'],
      };
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const apiKey = config.apiKey || process.env.LINEAR_API_KEY;
    if (!apiKey) {
      return { ok: false, message: 'API Key do Linear não informada.' };
    }

    try {
      const query = `query { viewer { id name email } }`;
      const res = await axios.post(
        'https://api.linear.app/graphql',
        { query },
        {
          headers: { Authorization: apiKey },
          timeout: 6000,
        }
      );
      const viewer = res.data?.data?.viewer;
      return {
        ok: true,
        message: `Conexão bem-sucedida com Linear! Autenticado como ${viewer?.name} (${viewer?.email}).`,
      };
    } catch (error: any) {
      return { ok: false, message: `Falha na conexão com Linear: ${error.message}` };
    }
  }
}
