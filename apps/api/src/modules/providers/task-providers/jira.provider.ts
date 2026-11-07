import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ITaskProvider, TaskCard } from './task-provider.interface';

@Injectable()
export class JiraProvider implements ITaskProvider {
  readonly providerType = 'JIRA';

  async fetchTask(cardId: string, config: Record<string, string>): Promise<TaskCard> {
    const baseUrl = config.baseUrl || process.env.JIRA_BASE_URL;
    const email = config.email || process.env.JIRA_EMAIL;
    const apiToken = config.apiToken || process.env.JIRA_API_TOKEN;

    if (!baseUrl || !email || !apiToken) {
      return {
        cardId,
        title: `Jira Issue ${cardId}`,
        description: `Implementar história/bug Jira ${cardId}.`,
        tags: ['jira'],
      };
    }

    try {
      const cleanBase = baseUrl.replace(/\/$/, '');
      const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
      const res = await axios.get(`${cleanBase}/rest/api/3/issue/${cardId}`, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      const fields = res.data?.fields || {};
      return {
        cardId,
        title: fields.summary || `Jira ${cardId}`,
        description: typeof fields.description === 'string' ? fields.description : JSON.stringify(fields.description || ''),
        tags: (fields.labels || []),
      };
    } catch {
      return {
        cardId,
        title: `Jira Issue ${cardId}`,
        description: `Implementar história/bug Jira ${cardId}.`,
        tags: ['jira'],
      };
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const baseUrl = config.baseUrl || process.env.JIRA_BASE_URL;
    const email = config.email || process.env.JIRA_EMAIL;
    const apiToken = config.apiToken || process.env.JIRA_API_TOKEN;

    if (!baseUrl || !email || !apiToken) {
      return { ok: false, message: 'URL Base, E-mail e API Token do Jira são obrigatórios.' };
    }

    try {
      const cleanBase = baseUrl.replace(/\/$/, '');
      const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
      const res = await axios.get(`${cleanBase}/rest/api/3/myself`, {
        headers: { Authorization: authHeader },
        timeout: 6000,
      });
      return {
        ok: true,
        message: `Conexão bem-sucedida com Jira! Usuário: ${res.data?.displayName || email}.`,
      };
    } catch (error: any) {
      return { ok: false, message: `Falha na conexão com Jira: ${error.message}` };
    }
  }
}
