import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ITaskProvider, TaskCard } from './task-provider.interface';

@Injectable()
export class KanbanizeProvider implements ITaskProvider {
  readonly providerType = 'KANBANIZE';
  private readonly logger = new Logger(KanbanizeProvider.name);

  async fetchTask(cardId: string, config: Record<string, string>): Promise<TaskCard> {
    const apiKey = config.apiKey || process.env.KANBANIZE_API_KEY;
    const subdomain = config.subdomain || process.env.KANBANIZE_SUBDOMAIN;

    if (!apiKey || !subdomain) {
      this.logger.warn('Credenciais do Kanbanize não configuradas. Retornando dados de simulação.');
      return {
        cardId,
        title: `Card #${cardId} (Simulação Kanbanize)`,
        description: `Implementar funcionalidade correspondente ao card #${cardId} com cobertura de testes e boas práticas.`,
        tags: ['kanbanize', 'feature'],
      };
    }

    try {
      const url = `https://${subdomain}.kanbanize.com/api/v2/cards/${cardId}`;
      const response = await axios.get(url, {
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const data = response.data?.data;

      // Busca subtasks já existentes se houver
      let subtasks: any[] = [];
      try {
        const subtasksRes = await axios.get(`https://${subdomain}.kanbanize.com/api/v2/cards/${cardId}/subtasks`, {
          headers: { apikey: apiKey },
          timeout: 5000,
        });
        subtasks = (subtasksRes.data?.data || []).map((s: any) => ({
          id: String(s.subtask_id || s.id),
          title: s.text || s.title || '',
          isFinished: Boolean(s.is_finished),
        }));
      } catch {
        // Silencioso se subtasks endpoint não retornar
      }

      return {
        cardId,
        title: data.title || `Card #${cardId}`,
        description: data.description || '',
        tags: data.tag_ids || [],
        boardId: data.board_id,
        subtasks,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao buscar card #${cardId} no Kanbanize: ${error.message}`);
      throw new Error(`Falha ao buscar Card #${cardId} no Kanbanize: ${error.response?.data?.message || error.message}`);
    }
  }

  async createSubtask(cardId: string, title: string, config: Record<string, string>): Promise<{ id: string; title: string }> {
    const apiKey = config.apiKey || process.env.KANBANIZE_API_KEY;
    const subdomain = config.subdomain || process.env.KANBANIZE_SUBDOMAIN;

    if (!apiKey || !subdomain) {
      return { id: `sim-subtask-${Date.now()}`, title };
    }

    try {
      const url = `https://${subdomain}.kanbanize.com/api/v2/cards/${cardId}/subtasks`;
      const response = await axios.post(
        url,
        { text: title },
        {
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        }
      );

      const created = response.data?.data;
      return {
        id: String(created?.subtask_id || created?.id || Date.now()),
        title: created?.text || title,
      };
    } catch (error: any) {
      this.logger.warn(`Erro ao criar subtask no Kanbanize: ${error.message}`);
      return { id: `fallback-${Date.now()}`, title };
    }
  }

  async completeSubtask(cardId: string, subtaskId: string, config: Record<string, string>): Promise<boolean> {
    const apiKey = config.apiKey || process.env.KANBANIZE_API_KEY;
    const subdomain = config.subdomain || process.env.KANBANIZE_SUBDOMAIN;

    if (!apiKey || !subdomain || subtaskId.startsWith('sim-') || subtaskId.startsWith('fallback-')) {
      return true;
    }

    try {
      const url = `https://${subdomain}.kanbanize.com/api/v2/cards/${cardId}/subtasks/${subtaskId}`;
      await axios.patch(
        url,
        { is_finished: 1 },
        {
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        }
      );
      return true;
    } catch (error: any) {
      this.logger.warn(`Erro ao finalizar subtask #${subtaskId} no Kanbanize: ${error.message}`);
      return false;
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const apiKey = config.apiKey || process.env.KANBANIZE_API_KEY;
    const subdomain = config.subdomain || process.env.KANBANIZE_SUBDOMAIN;

    if (!apiKey || !subdomain) {
      return { ok: false, message: 'Subdomínio e API Key do Kanbanize são obrigatórios.' };
    }

    try {
      const url = `https://${subdomain}.kanbanize.com/api/v2/users/me`;
      const response = await axios.get(url, {
        headers: { apikey: apiKey },
        timeout: 6000,
      });

      const user = response.data?.data;
      return {
        ok: true,
        message: `Conexão bem-sucedida com Kanbanize (${subdomain})! Usuário: ${user?.username || user?.email || 'OK'}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        message: `Falha na conexão com Kanbanize: ${error.response?.data?.message || error.message}`,
      };
    }
  }
}
