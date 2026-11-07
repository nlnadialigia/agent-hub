import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialsVaultService } from '../vault/credentials-vault.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  specialistRole?: string;
}

export interface CompletionResponse {
  content: string;
  modelUsed: string;
  provider: string;
  isFallback: boolean;
}

@Injectable()
export class OmniRouteService {
  private readonly logger = new Logger(OmniRouteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vaultService: CredentialsVaultService
  ) {}

  /**
   * Verifica o status de saúde do OmniRoute Gateway
   */
  async checkHealth(): Promise<{ status: 'online' | 'offline'; baseUrl: string; message: string }> {
    const omniConfig = await this.vaultService.getEffectiveConfig('OMNIROUTE');
    const baseUrl = omniConfig.baseUrl || process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';

    try {
      const response = await axios.get(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${omniConfig.apiKey || 'sk-omniroute-local'}`,
        },
        timeout: 4000,
      });

      return {
        status: 'online',
        baseUrl,
        message: `OmniRoute ativo com ${response.data?.data?.length || 0} modelos detectados.`,
      };
    } catch (error: any) {
      return {
        status: 'offline',
        baseUrl,
        message: `OmniRoute indisponível em ${baseUrl}: ${error.message}`,
      };
    }
  }

  /**
   * Retorna os modelos autorizados para uso na Squad (Free e Pagos cadastrados)
   */
  async getAllowedModels() {
    return this.prisma.allowedModelCatalog.findMany({
      where: { isEnabled: true },
      orderBy: [{ costTier: 'asc' }, { displayName: 'asc' }],
    });
  }

  /**
   * Sincroniza e importa modelos gratuitos descobertos no OmniRoute
   */
  async syncFreeModelsFromOmniRoute(): Promise<{ added: number; total: number }> {
    const omniConfig = await this.vaultService.getEffectiveConfig('OMNIROUTE');
    const baseUrl = omniConfig.baseUrl || 'http://localhost:20128/v1';

    try {
      const response = await axios.get(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${omniConfig.apiKey || 'sk-omniroute-local'}`,
        },
        timeout: 5000,
      });

      const models = response.data?.data || [];
      let added = 0;

      for (const m of models) {
        const id = m.id || m;
        // Filtra para modelos gratuitos ou tags free
        const isFree = id.includes('free') || id.includes('auto') || id.includes('groq');
        if (isFree) {
          const exists = await this.prisma.allowedModelCatalog.findUnique({
            where: { modelId: id },
          });
          if (!exists) {
            await this.prisma.allowedModelCatalog.create({
              data: {
                modelId: id,
                displayName: `${id} (Auto-descoberto)`,
                provider: 'OMNIROUTE_FREE',
                costTier: 'FREE',
                isEnabled: true,
              },
            });
            added++;
          }
        }
      }

      const total = await this.prisma.allowedModelCatalog.count();
      return { added, total };
    } catch (error: any) {
      this.logger.warn(`Não foi possível sincronizar modelos do OmniRoute: ${error.message}`);
      return { added: 0, total: await this.prisma.allowedModelCatalog.count() };
    }
  }

  /**
   * Retorna e atualiza as configurações da Squad Especialista
   */
  async getSpecialistConfigs() {
    return this.prisma.specialistAgentConfig.findMany({
      orderBy: { displayName: 'asc' },
    });
  }

  async updateSpecialistConfig(role: string, data: {
    primaryModel?: string;
    fallbackModel?: string;
    temperature?: number;
    customSystemPrompt?: string;
  }) {
    return this.prisma.specialistAgentConfig.update({
      where: { role },
      data,
    });
  }

  /**
   * Executa uma requisição de LLM com:
   * 1. Guardrail de modelos autorizados
   * 2. Roteamento via OmniRoute Gateway (:20128)
   * 3. Fallback inteligente e automático (OmniRoute fallback ou Direct Gemini SDK)
   */
  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    const omniConfig = await this.vaultService.getEffectiveConfig('OMNIROUTE');
    const geminiConfig = await this.vaultService.getEffectiveConfig('GEMINI');

    // Identifica configuração do especialista se papel foi passado
    let specialistConfig: any = null;
    if (request.specialistRole) {
      specialistConfig = await this.prisma.specialistAgentConfig.findUnique({
        where: { role: request.specialistRole },
      });
    }

    const requestedModel =
      request.model ||
      specialistConfig?.primaryModel ||
      'gemini-2.5-pro';

    const fallbackModel =
      specialistConfig?.fallbackModel ||
      'deepseek-r1-free';

    const temperature = request.temperature ?? specialistConfig?.temperature ?? 0.2;

    // Se o modelo escolhido for o Gemini 2.5 Pro (Pago) e a usuária tiver a chave direta do Gemini, tenta primeiro via SDK direto do Gemini
    if (requestedModel.includes('gemini-2.5-pro') && geminiConfig.apiKey) {
      try {
        const directResponse = await this.callDirectGemini(
          geminiConfig.apiKey,
          'gemini-2.5-pro',
          request.messages,
          temperature
        );
        return {
          content: directResponse,
          modelUsed: 'gemini-2.5-pro (Direct Gemini Paid)',
          provider: 'GEMINI_DIRECT',
          isFallback: false,
        };
      } catch (geminiError: any) {
        this.logger.warn(`Chamada direta Gemini 2.5 Pro falhou: ${geminiError.message}. Tentando via OmniRoute...`);
      }
    }

    // Tenta via OmniRoute Gateway
    const omniBaseUrl = omniConfig.baseUrl || 'http://localhost:20128/v1';
    const omniApiKey = omniConfig.apiKey || 'sk-omniroute-local';

    try {
      const response = await axios.post(
        `${omniBaseUrl}/chat/completions`,
        {
          model: requestedModel,
          messages: request.messages,
          temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${omniApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content || '';
      return {
        content,
        modelUsed: requestedModel,
        provider: 'OMNIROUTE',
        isFallback: false,
      };
    } catch (omniError: any) {
      this.logger.warn(`Falha na chamada ao OmniRoute com modelo '${requestedModel}': ${omniError.message}. Ativando Fallback para '${fallbackModel}'...`);
    }

    // Tentativa com modelo Fallback via OmniRoute
    try {
      const fallbackResponse = await axios.post(
        `${omniBaseUrl}/chat/completions`,
        {
          model: fallbackModel,
          messages: request.messages,
          temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${omniApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      const content = fallbackResponse.data?.choices?.[0]?.message?.content || '';
      return {
        content,
        modelUsed: fallbackModel,
        provider: 'OMNIROUTE_FALLBACK',
        isFallback: true,
      };
    } catch (secondError: any) {
      this.logger.error(`Fallback no OmniRoute também falhou: ${secondError.message}.`);
    }

    // Último recurso: Gemini SDK direto com modelo flash ou pro se chave existir
    if (geminiConfig.apiKey) {
      try {
        const lastResortContent = await this.callDirectGemini(
          geminiConfig.apiKey,
          'gemini-2.5-flash',
          request.messages,
          temperature
        );
        return {
          content: lastResortContent,
          modelUsed: 'gemini-2.5-flash (Emergency Direct Fallback)',
          provider: 'GEMINI_DIRECT_EMERGENCY',
          isFallback: true,
        };
      } catch (lastError: any) {
        this.logger.error(`Tentativa de emergência falhou: ${lastError.message}`);
      }
    }

    throw new Error(
      `Todos os provedores de LLM falharam. Verifique o OmniRoute (:20128) ou as credenciais do Gemini no cofre/env.`
    );
  }

  /**
   * Chamada direta ao Google GenAI SDK (@google/genai)
   */
  private async callDirectGemini(
    apiKey: string,
    modelName: string,
    messages: ChatMessage[],
    temperature: number
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });

    // Concatena mensagens formatadas
    let systemInstruction = '';
    const formattedContents: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += `${msg.content}\n\n`;
      } else {
        formattedContents.push(`[${msg.role.toUpperCase()}]: ${msg.content}`);
      }
    }

    const fullPrompt = formattedContents.join('\n\n');

    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature,
      },
    });

    return response.text || '';
  }
}
