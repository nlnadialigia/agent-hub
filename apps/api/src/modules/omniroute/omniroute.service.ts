import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialsVaultService } from '../vault/credentials-vault.service';
import { AgentGateway } from '../gateway/agent.gateway';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  specialistRole?: string;
  taskId?: string;
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
    private readonly vaultService: CredentialsVaultService,
    private readonly gateway: AgentGateway
  ) {}

  /**
   * Resolve a URL acessível do OmniRoute testando interna (omniroute:20128) e externa (localhost:20128)
   */
  async resolveWorkingBaseUrl(): Promise<string> {
    const omniConfig = await this.vaultService.getEffectiveConfig('OMNIROUTE');
    const candidates = [
      'http://omniroute:20128/v1',
      process.env.OMNIROUTE_BASE_URL,
      omniConfig.baseUrl,
      'http://localhost:20128/v1',
    ].filter(Boolean) as string[];

    const uniqueCandidates = Array.from(new Set(candidates));

    for (const url of uniqueCandidates) {
      try {
        await axios.get(`${url}/models`, {
          headers: { Authorization: `Bearer ${omniConfig.apiKey || 'sk-omniroute-local'}` },
          timeout: 2500,
        });
        return url;
      } catch {
        try {
          const rootUrl = url.replace(/\/v1\/?$/, '');
          const res = await axios.get(`${rootUrl}/healthz`, { timeout: 1500 });
          if (res.status === 200) return url;
        } catch {
          // Tenta o próximo
        }
      }
    }

    return uniqueCandidates[0] || 'http://omniroute:20128/v1';
  }

  /**
   * Verifica o status de saúde do OmniRoute Gateway
   */
  async checkHealth(): Promise<{ status: 'online' | 'offline'; baseUrl: string; message: string }> {
    const omniConfig = await this.vaultService.getEffectiveConfig('OMNIROUTE');
    const candidates = [
      'http://omniroute:20128/v1',
      process.env.OMNIROUTE_BASE_URL,
      omniConfig.baseUrl,
      'http://localhost:20128/v1',
    ].filter(Boolean) as string[];

    const uniqueCandidates = Array.from(new Set(candidates));

    for (const baseUrl of uniqueCandidates) {
      try {
        const response = await axios.get(`${baseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${omniConfig.apiKey || 'sk-omniroute-local'}`,
          },
          timeout: 3000,
        });

        return {
          status: 'online',
          baseUrl,
          message: `OmniRoute ativo com ${response.data?.data?.length || 0} modelos detectados.`,
        };
      } catch (err: any) {
        // Fallback: se o gateway estiver rodando mas sem modelos ou aguardando autenticação, probe /healthz
        try {
          const rootUrl = baseUrl.replace(/\/v1\/?$/, '');
          const healthzRes = await axios.get(`${rootUrl}/healthz`, { timeout: 2000 });
          if (healthzRes.status === 200) {
            return {
              status: 'online',
              baseUrl,
              message: 'OmniRoute Online :20128 (Gateway ativo e operacional).',
            };
          }
        } catch {
          // Tenta próxima URL candidata
        }
      }
    }

    const failedUrl = uniqueCandidates[0] || 'http://omniroute:20128/v1';
    return {
      status: 'offline',
      baseUrl: failedUrl,
      message: `OmniRoute indisponível em ${failedUrl}. Verifique o container 'agent_hub_omniroute'.`,
    };
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
    const baseUrl = await this.resolveWorkingBaseUrl();

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
    const omniBaseUrl = await this.resolveWorkingBaseUrl();
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
    let lastOmniErrorMessage = 'Gateway indisponível ou modelo não configurado no OmniRoute';
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
      const detail = secondError.response?.data?.error?.message || secondError.message;
      lastOmniErrorMessage = `Falha no OmniRoute (${requestedModel} / ${fallbackModel}): ${detail}`;
      this.logger.error(`Fallback no OmniRoute também falhou: ${secondError.message}.`);
    }

    // -------------------------------------------------------------------------
    // CONFIRMAÇÃO HUMANA ANTES DE TROCAR PARA A IA PAGA (ISSUE #8)
    // -------------------------------------------------------------------------
    let effectiveGeminiApiKey = geminiConfig.apiKey || process.env.GEMINI_API_KEY || '';
    let selectedPaidModel = 'gemini-2.5-pro';
    let isAuthorizedForPaid = false;

    if (request.taskId) {
      const taskRecord = await this.prisma.taskExecution.findUnique({
        where: { id: request.taskId },
      });
      const previousStatus = taskRecord?.status || 'PENDING_DIAGNOSTIC';

      if (taskRecord?.allowPaidFallback) {
        isAuthorizedForPaid = true;
      } else {
        this.gateway.emitLog(
          request.taskId,
          `⚠️ OmniRoute indisponível ou falhou (${lastOmniErrorMessage}). Aguardando sua confirmação para trocar para a IA Paga (Gemini Direto)...`,
          'warn',
          '💳 Guardrail de Custo'
        );

        await this.prisma.taskExecution.update({
          where: { id: request.taskId },
          data: { status: 'WAITING_FALLBACK_CONFIRMATION' },
        });

        const decision = await this.gateway.requestPaidFallbackDecision({
          taskId: request.taskId,
          specialistRole: request.specialistRole || 'ORCHESTRATOR',
          failedPrimaryModel: requestedModel,
          failedFallbackModel: fallbackModel,
          omniErrorMessage: lastOmniErrorMessage,
          suggestedPaidModel: 'gemini-2.5-pro',
          hasConfiguredPaidKey: Boolean(effectiveGeminiApiKey),
        });

        // Restaura o status anterior da etapa em andamento
        const restoredStatus =
          previousStatus === 'WAITING_FALLBACK_CONFIRMATION'
            ? request.specialistRole === 'ORCHESTRATOR'
              ? 'PENDING_DIAGNOSTIC'
              : 'IMPLEMENTING'
            : previousStatus;

        await this.prisma.taskExecution.update({
          where: { id: request.taskId },
          data: {
            status: restoredStatus,
            ...(decision.action === 'APPROVE_TASK' ? { allowPaidFallback: true } : {}),
          },
        });
        this.gateway.emitStatus(request.taskId, restoredStatus);

        if (decision.action === 'DECLINE') {
          this.gateway.emitLog(
            request.taskId,
            'Troca para IA Paga recusada pelo usuário. Encerrando execução sem gerar custos.',
            'warn',
            '💳 Guardrail de Custo'
          );
          throw new Error(
            `OmniRoute falhou (${lastOmniErrorMessage}) e a troca para a IA Paga foi recusada pelo usuário.`
          );
        }

        if (decision.paidModel) {
          selectedPaidModel = decision.paidModel;
        }

        if (decision.apiKeyOverride?.trim()) {
          effectiveGeminiApiKey = decision.apiKeyOverride.trim();
          await this.vaultService.saveConnection({
            category: 'LLM_PROVIDER',
            providerType: 'GEMINI',
            name: 'Google Gemini (Pago)',
            config: { apiKey: effectiveGeminiApiKey },
            isDefault: true,
          });
        }

        isAuthorizedForPaid = true;
        this.gateway.emitLog(
          request.taskId,
          `✅ Troca para IA Paga autorizada (${selectedPaidModel}). Retomando processamento...`,
          'success',
          '💳 Guardrail de Custo'
        );
      }
    } else {
      // Chamada avulsa sem taskId (se houver chave)
      isAuthorizedForPaid = Boolean(effectiveGeminiApiKey);
    }

    // Executa na IA Paga (Gemini SDK Direto) após autorização
    if (isAuthorizedForPaid && effectiveGeminiApiKey) {
      try {
        const lastResortContent = await this.callDirectGemini(
          effectiveGeminiApiKey,
          selectedPaidModel,
          request.messages,
          temperature
        );
        return {
          content: lastResortContent,
          modelUsed: `${selectedPaidModel} (Gemini Pago Autorizado)`,
          provider: 'GEMINI_DIRECT_AUTHORIZED',
          isFallback: true,
        };
      } catch (lastError: any) {
        this.logger.error(`Tentativa na IA Paga (${selectedPaidModel}) falhou: ${lastError.message}`);
        throw new Error(
          `OmniRoute falhou e a chamada na IA Paga (${selectedPaidModel}) também retornou erro: ${lastError.message}`
        );
      }
    }

    throw new Error(
      `Todos os provedores de LLM falharam (${lastOmniErrorMessage}). Verifique o OmniRoute (:20128) ou cadastre sua GEMINI_API_KEY na aba Configurações & Integrações.`
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
