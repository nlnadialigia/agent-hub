import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { execa } from 'execa';
import { ITaskProvider, TaskCard } from './task-provider.interface';

@Injectable()
export class GitHubIssuesProvider implements ITaskProvider {
  readonly providerType = 'GITHUB_ISSUES';
  private readonly logger = new Logger(GitHubIssuesProvider.name);

  async fetchTask(cardId: string, config: Record<string, string>): Promise<TaskCard> {
    const token = config.token || process.env.GITHUB_TOKEN;
    const cleanNumber = cardId.replace(/[^0-9]/g, '');

    // 1. Tentar via GitHub CLI se disponível
    try {
      const { stdout } = await execa('gh', [
        'issue',
        'view',
        cleanNumber,
        '--json',
        'number,title,body,labels',
      ]);
      const data = JSON.parse(stdout);
      return {
        cardId: String(data.number),
        title: data.title,
        description: data.body || '',
        tags: (data.labels || []).map((l: any) => l.name),
      };
    } catch {
      // gh cli não disponível ou falhou, tenta REST API
    }

    // 2. Tentar via GitHub REST API se houver repo informado
    if (token) {
      try {
        const repo = config.repo || process.env.GITHUB_REPOSITORY;
        if (repo) {
          const res = await axios.get(`https://api.github.com/repos/${repo}/issues/${cleanNumber}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
            timeout: 8000,
          });
          return {
            cardId: String(res.data.number),
            title: res.data.title,
            description: res.data.body || '',
            tags: (res.data.labels || []).map((l: any) => l.name),
          };
        }
      } catch (err: any) {
        this.logger.warn(`Falha na API do GitHub para Issue #${cleanNumber}: ${err.message}`);
      }
    }

    // 3. Fallback simulado
    return {
      cardId: cleanNumber || cardId,
      title: `Issue #${cleanNumber || cardId} do GitHub`,
      description: `Implementar a demanda descrita na issue #${cleanNumber || cardId} do GitHub.`,
      tags: ['github-issue'],
    };
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const token = config.token || process.env.GITHUB_TOKEN;
    if (!token) {
      return { ok: false, message: 'Token do GitHub (GITHUB_TOKEN) não informado.' };
    }

    try {
      const res = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 6000,
      });
      return {
        ok: true,
        message: `Conexão bem-sucedida com GitHub! Autenticado como @${res.data.login}.`,
      };
    } catch (error: any) {
      return {
        ok: false,
        message: `Falha na autenticação do GitHub: ${error.response?.data?.message || error.message}`,
      };
    }
  }
}
