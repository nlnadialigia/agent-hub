import { Injectable, Logger } from '@nestjs/common';
import { OmniRouteService, ChatMessage } from '../omniroute/omniroute.service';

export interface DiagnosticResult {
  rawMarkdown: string;
  assignedSpecialists: string[];
  subtasks: string[];
  summary: string;
}

@Injectable()
export class OrchestratorAgent {
  private readonly logger = new Logger(OrchestratorAgent.name);

  constructor(private readonly omniService: OmniRouteService) {}

  /**
   * Gera o Diagnóstico Técnico Antigravity focado em texto e regras de negócio
   * Incorpora a técnica Grill-Me para mapeamento de decisões
   */
  async generateDiagnostic(params: {
    cardId: string;
    cardTitle: string;
    cardDescription: string;
    customInstructions?: string;
    repoProfile: any;
    previousFeedback?: string;
    existingDiagnostic?: string;
  }): Promise<DiagnosticResult> {
    this.logger.log(`🎯 [Tech Lead Orchestrator] Gerando diagnóstico para '${params.cardTitle}'...`);

    const systemPrompt = `
Você é o Tech Lead Orchestrator de uma Squad de Engenharia Autônoma de Alta Performance.
Sua missão é produzir um Diagnóstico Técnico Arquitetural no padrão Antigravity (agy).

DIRETRIZES CRÍTICAS:
1. FOCO TOTAL EM TEXTO E REGRAS DE NEGÓCIO: O usuário exige clareza textual, explicação detalhada de como você compreendeu o problema, a solução e as regras de negócio. NÃO polua o diagnóstico com longos blocos de código. Use pouquíssimo código (apenas assinaturas de tipos ou DTOs se estritamente necessário).
2. SEÇÃO GRILL-ME (ÁRVORE DE DECISÕES): Mapeie premissas validadas tecnicamente pelo repositório e fronteiras de negócio com ambiguidades, sempre acompanhadas da sua recomendação pronta ("➡️ Recomendação do Tech Lead").
3. ESCALAÇÃO DA SQUAD: Identifique explicitamente quais especialistas participarão da execução entre:
   - DATABASE (Modelagem relacional, migrations, integridade)
   - BACKEND_NODE (NestJS/Fastify/TS/Zod)
   - BACKEND_PYTHON (FastAPI/Django/Python/Pydantic)
   - FRONTEND (React/Next.js/Tailwind/UI)
   - QA_DEVOPS (Testes automatizados, self-healing, Docker)
4. SUBTASKS DO BOARD: Liste de 3 a 6 subtasks objetivas que serão criadas automaticamente no Kanbanize/Board.

ESTRUTURA OBRIGATÓRIA DO DIAGNÓSTICO:
# 🎯 Diagnóstico Técnico & Arquitetural (Tech Lead)
## 1. 📌 Entendimento do Problema & Regra de Negócio
(Explicação conceitual e textual de como você entendeu a demanda)
## 2. 🗺️ Mapa de Impacto Arquitetural
(Módulos e arquivos a criar ou alterar, explicando o porquê de cada um)
## 3. 🤖 Escalação da Squad Especialista
(Quais agentes serão ativados e suas responsabilidades)
## 4. 📋 Subtasks Planejadas para o Board
(Lista com bullets com títulos curtos para criação no Kanbanize)
## 5. 🔥 Árvore de Decisões & Grill-Me
(Decisões tomadas e opções com "➡️ Recomendação do Tech Lead")
## 6. 🧪 Critérios de Aceite & Validação
`;

    const userPrompt = `
DADOS DA DEMANDA:
- Card / Issue: #${params.cardId} - ${params.cardTitle}
- Descrição Original: ${params.cardDescription || 'Sem descrição.'}
- Instruções Adicionais do Usuário (Markdown): ${params.customInstructions || 'Nenhuma instrução adicional.'}

PERFIL DO REPOSITÓRIO ALVO:
- Nome: ${params.repoProfile.name}
- Stacks Detectadas: ${JSON.stringify(params.repoProfile.stacks || [])}
- Frameworks: ${JSON.stringify(params.repoProfile.frameworks || {})}
- ORM: ${params.repoProfile.orm || 'Nenhum'}
- Target Branch para PR: ${params.repoProfile.targetBranch || 'main'}
- Testes: ${JSON.stringify(params.repoProfile.testFrameworks || [])}

${
  params.previousFeedback
    ? `
⚠️ ATENÇÃO - REFINAMENTO SOLICITADO PELO USUÁRIO NO DIAGNÓSTICO ANTERIOR:
"${params.previousFeedback}"

DIAGNÓSTICO ANTERIOR PARA AJUSTE:
${params.existingDiagnostic}

Incorpore rigorosamente o feedback acima mantendo o foco em texto explicativo e pouquíssimo código.
`
    : ''
}
`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.omniService.generateCompletion({
      specialistRole: 'ORCHESTRATOR',
      messages,
      temperature: 0.2,
    });

    const parsed = this.parseDiagnostic(response.content, params.repoProfile);

    return {
      rawMarkdown: response.content,
      assignedSpecialists: parsed.assignedSpecialists,
      subtasks: parsed.subtasks,
      summary: parsed.summary,
    };
  }

  /**
   * Extrai metadados do Markdown gerado
   */
  private parseDiagnostic(markdown: string, repoProfile: any): { assignedSpecialists: string[]; subtasks: string[]; summary: string } {
    const assigned: Set<string> = new Set();
    const upper = markdown.toUpperCase();

    if (upper.includes('DATABASE') || upper.includes('MIGRATION') || upper.includes('PRISMA')) assigned.add('DATABASE');
    if (upper.includes('BACKEND_NODE') || upper.includes('NESTJS') || upper.includes('NODE')) assigned.add('BACKEND_NODE');
    if (upper.includes('BACKEND_PYTHON') || upper.includes('FASTAPI') || upper.includes('PYTHON')) assigned.add('BACKEND_PYTHON');
    if (upper.includes('FRONTEND') || upper.includes('REACT') || upper.includes('TAILWIND')) assigned.add('FRONTEND');
    assigned.add('QA_DEVOPS'); // QA sempre ativo para validação

    // Se nenhum foi detectado além de QA, ativa com base no perfil do repositório
    if (assigned.size === 1) {
      if (repoProfile.stacks?.includes('NODE_TS')) assigned.add('BACKEND_NODE');
      if (repoProfile.stacks?.includes('PYTHON')) assigned.add('BACKEND_PYTHON');
      if (repoProfile.stacks?.includes('FRONTEND') || repoProfile.stacks?.includes('REACT')) assigned.add('FRONTEND');
      if (repoProfile.orm) assigned.add('DATABASE');
    }

    // Extrai subtasks da seção 4
    const subtasks: string[] = [];
    const sectionMatch = markdown.match(/## 4\.[^\n]*\n([\s\S]*?)(##|$)/);
    if (sectionMatch && sectionMatch[1]) {
      const lines = sectionMatch[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
          const text = trimmed.replace(/^[-*\d.]+\s*/, '').replace(/\[.*?\]/, '').trim();
          if (text.length > 5) {
            subtasks.push(text);
          }
        }
      }
    }

    if (subtasks.length === 0) {
      subtasks.push('Análise e modelagem de arquitetura');
      subtasks.push('Implementação da regra de negócio nos serviços');
      subtasks.push('Testes automatizados e garantia de qualidade');
    }

    // Resumo simples
    const firstParagraph = markdown.split('\n\n').find((p) => p.length > 30 && !p.startsWith('#')) || 'Diagnóstico concluído.';

    return {
      assignedSpecialists: Array.from(assigned),
      subtasks,
      summary: firstParagraph.replace(/[#*`]/g, '').trim(),
    };
  }
}
