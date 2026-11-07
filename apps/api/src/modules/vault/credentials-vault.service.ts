import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CredentialsVaultService {
  private readonly logger = new Logger(CredentialsVaultService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;

  constructor(private readonly prisma: PrismaService) {
    const rawSecret = process.env.VAULT_SECRET_KEY || 'agent_hub_default_super_secret_vault_key_2026';
    this.encryptionKey = crypto.createHash('sha256').update(rawSecret).digest();
  }

  /**
   * Criptografa um objeto JSON com AES-256-GCM
   */
  encrypt(data: Record<string, any>): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    const text = JSON.stringify(data);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag,
      content: encrypted,
    });
  }

  /**
   * Decriptografa o payload cifrado
   */
  decrypt(payloadStr: string): Record<string, any> {
    try {
      const parsed = JSON.parse(payloadStr);
      if (!parsed.iv || !parsed.authTag || !parsed.content) {
        // Fallback caso seja um JSON legado ou plano
        return parsed;
      }

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        Buffer.from(parsed.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));

      let decrypted = decipher.update(parsed.content, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error: any) {
      this.logger.error(`Erro ao decriptografar credencial: ${error.message}`);
      return {};
    }
  }

  /**
   * Salva ou atualiza uma conexão de integração no banco
   */
  async saveConnection(data: {
    category: 'TASK_PROVIDER' | 'VCS_PROVIDER' | 'LLM_PROVIDER';
    providerType: string;
    name: string;
    config: Record<string, any>;
    isDefault?: boolean;
  }) {
    const encryptedConfig = this.encrypt(data.config);

    return this.prisma.integrationConnection.upsert({
      where: { providerType: data.providerType },
      update: {
        name: data.name,
        category: data.category,
        configJson: encryptedConfig,
        isDefault: data.isDefault ?? false,
        isActive: true,
      },
      create: {
        name: data.name,
        category: data.category,
        providerType: data.providerType,
        configJson: encryptedConfig,
        isDefault: data.isDefault ?? false,
        isActive: true,
      },
    });
  }

  /**
   * Lista todas as conexões salvas mascarando tokens
   */
  async listConnections() {
    const connections = await this.prisma.integrationConnection.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return connections.map((conn) => {
      const raw = this.decrypt(conn.configJson);
      const masked: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string') {
          if (value.length > 8) {
            masked[key] = `${value.slice(0, 4)}...${value.slice(-4)}`;
          } else {
            masked[key] = '••••••••';
          }
        } else {
          masked[key] = String(value);
        }
      }

      return {
        id: conn.id,
        name: conn.name,
        category: conn.category,
        providerType: conn.providerType,
        isDefault: conn.isDefault,
        isActive: conn.isActive,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
        configMasked: masked,
      };
    });
  }

  /**
   * Obtém a configuração efetiva para um provedor:
   * Prioridade: 1) Banco de Dados (Cofre) -> 2) Variáveis de Ambiente (.env)
   */
  async getEffectiveConfig(providerType: string): Promise<Record<string, string>> {
    let dbConfig: Record<string, any> = {};

    try {
      const conn = await this.prisma.integrationConnection.findUnique({
        where: { providerType },
      });
      if (conn && conn.isActive) {
        dbConfig = this.decrypt(conn.configJson);
      }
    } catch {
      // Caso banco não esteja acessível momentaneamente
    }

    const envFallback = this.getEnvFallback(providerType);

    // Merge: banco sobrescreve .env quando preenchido
    return {
      ...envFallback,
      ...Object.fromEntries(
        Object.entries(dbConfig).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      ),
    };
  }

  /**
   * Mapeamento de fallback para variáveis de ambiente
   */
  private getEnvFallback(providerType: string): Record<string, string> {
    switch (providerType) {
      case 'GITHUB':
      case 'GITHUB_ISSUES':
        return {
          token: process.env.GITHUB_TOKEN || '',
        };
      case 'KANBANIZE':
        return {
          apiKey: process.env.KANBANIZE_API_KEY || '',
          subdomain: process.env.KANBANIZE_SUBDOMAIN || '',
        };
      case 'AZURE_DEVOPS':
        return {
          orgUrl: process.env.AZURE_DEVOPS_ORG_URL || '',
          project: process.env.AZURE_DEVOPS_PROJECT || '',
          token: process.env.AZURE_DEVOPS_TOKEN || process.env.AZURE_DEVOPS_PAT || '',
        };
      case 'JIRA':
        return {
          baseUrl: process.env.JIRA_BASE_URL || '',
          email: process.env.JIRA_EMAIL || '',
          apiToken: process.env.JIRA_API_TOKEN || '',
        };
      case 'TRELLO':
        return {
          apiKey: process.env.TRELLO_API_KEY || '',
          token: process.env.TRELLO_TOKEN || '',
        };
      case 'LINEAR':
        return {
          apiKey: process.env.LINEAR_API_KEY || '',
        };
      case 'GITLAB':
        return {
          token: process.env.GITLAB_TOKEN || '',
          baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com',
        };
      case 'BITBUCKET':
        return {
          token: process.env.BITBUCKET_TOKEN || '',
          username: process.env.BITBUCKET_USERNAME || '',
        };
      case 'OMNIROUTE':
        return {
          baseUrl: process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1',
          apiKey: process.env.OMNIROUTE_API_KEY || 'sk-omniroute-local',
        };
      case 'GEMINI':
        return {
          apiKey: process.env.GEMINI_API_KEY || '',
        };
      default:
        return {};
    }
  }

  /**
   * Remove uma conexão do cofre
   */
  async deleteConnection(id: string) {
    return this.prisma.integrationConnection.delete({
      where: { id },
    });
  }
}
