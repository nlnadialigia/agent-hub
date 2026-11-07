import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do Agent Hub...');

  // 1. Catálogo Curado de Modelos Autorizados (Free + Gemini Pago)
  const allowedModels = [
    {
      modelId: 'gemini-2.5-pro',
      displayName: 'Google Gemini 2.5 Pro (Pago)',
      provider: 'GEMINI_PAID',
      costTier: 'PAID',
      isEnabled: true,
    },
    {
      modelId: 'gemini-2.5-pro-free',
      displayName: 'Google Gemini 2.5 Pro (Free)',
      provider: 'OMNIROUTE_FREE',
      costTier: 'FREE',
      isEnabled: true,
    },
    {
      modelId: 'gemini-2.5-flash-free',
      displayName: 'Google Gemini 2.5 Flash (Free)',
      provider: 'OMNIROUTE_FREE',
      costTier: 'FREE',
      isEnabled: true,
    },
    {
      modelId: 'deepseek-v3-free',
      displayName: 'DeepSeek V3 (Free)',
      provider: 'OMNIROUTE_FREE',
      costTier: 'FREE',
      isEnabled: true,
    },
    {
      modelId: 'deepseek-r1-free',
      displayName: 'DeepSeek R1 Reasoning (Free)',
      provider: 'OMNIROUTE_FREE',
      costTier: 'FREE',
      isEnabled: true,
    },
    {
      modelId: 'qwen-2.5-coder-free',
      displayName: 'Qwen 2.5 Coder 32B (Free)',
      provider: 'OMNIROUTE_FREE',
      costTier: 'FREE',
      isEnabled: true,
    },
    {
      modelId: 'llama-3.3-70b-groq',
      displayName: 'Llama 3.3 70B (Groq Free)',
      provider: 'GROQ_FREE',
      costTier: 'FREE',
      isEnabled: true,
    },
    {
      modelId: 'auto',
      displayName: 'OmniRoute Auto (Melhor Free Disponível)',
      provider: 'OMNIROUTE_FREE',
      costTier: 'FREE',
      isEnabled: true,
    },
  ];

  for (const model of allowedModels) {
    await prisma.allowedModelCatalog.upsert({
      where: { modelId: model.modelId },
      update: model,
      create: model,
    });
  }
  console.log(`✅ ${allowedModels.length} modelos autorizados populados no catálogo.`);

  // 2. Configuração Padrão da Squad Especialista (6 Especialistas)
  const specialistConfigs = [
    {
      role: 'ORCHESTRATOR',
      displayName: '🎯 Tech Lead Orchestrator',
      description: 'Responsável pelo diagnóstico Antigravity, entendimento de negócio e orquestração da squad.',
      llmProvider: 'OMNIROUTE',
      primaryModel: 'gemini-2.5-pro', // Modelo Pago do usuário
      fallbackModel: 'deepseek-r1-free',
      temperature: 0.2,
      customSystemPrompt: 'Você é o Tech Lead Orchestrator. Foque em entendimento textual profundo de regras de negócio, arquitetura limpa e plano de impacto com pouquíssimo código no diagnóstico.',
    },
    {
      role: 'BACKEND_NODE',
      displayName: '🟢 Backend Node/TS Specialist',
      description: 'Especialista em NestJS, Fastify, Express, Prisma, Drizzle, TypeORM e validações com Zod.',
      llmProvider: 'OMNIROUTE',
      primaryModel: 'deepseek-v3-free',
      fallbackModel: 'qwen-2.5-coder-free',
      temperature: 0.1,
      customSystemPrompt: 'Você é o Backend Node/TS Specialist. Sempre use TypeScript estrito, DTOs tipados com Zod e padrões idiomáticos do ecossistema Node/TS.',
    },
    {
      role: 'BACKEND_PYTHON',
      displayName: '🐍 Backend Python Specialist',
      description: 'Especialista em FastAPI, Django, Flask, Pydantic, Poetry, uv e Pytest.',
      llmProvider: 'OMNIROUTE',
      primaryModel: 'qwen-2.5-coder-free',
      fallbackModel: 'auto',
      temperature: 0.1,
      customSystemPrompt: 'Você é o Backend Python Specialist. Use type hints PEP 484, Pydantic v2 e boas práticas Pythonicas.',
    },
    {
      role: 'FRONTEND',
      displayName: '🎨 Frontend Web Specialist',
      description: 'Especialista em React, Next.js, Vite, Tailwind CSS, shadcn/ui, Vue e Angular.',
      llmProvider: 'OMNIROUTE',
      primaryModel: 'gemini-2.5-flash-free',
      fallbackModel: 'auto',
      temperature: 0.2,
      customSystemPrompt: 'Você é o Frontend Web Specialist. Desenvolva interfaces modernas, acessíveis, responsivas com Tailwind CSS e suporte a tema Light/Dark.',
    },
    {
      role: 'DATABASE',
      displayName: '🗄️ Database & ORM Specialist',
      description: 'Especialista em schemas relacionais, migrations, integridade de dados e consultas de alta performance.',
      llmProvider: 'OMNIROUTE',
      primaryModel: 'gemini-2.5-pro-free',
      fallbackModel: 'auto',
      temperature: 0.1,
      customSystemPrompt: 'Você é o Database & ORM Specialist. Garanta migrations seguras sem perda de dados, integridade referencial e índices adequados.',
    },
    {
      role: 'QA_DEVOPS',
      displayName: '🧪 QA, E2E & DevOps Specialist',
      description: 'Especialista em Jest, Vitest, Pytest, Playwright, Docker, CI/CD e Self-Healing de testes.',
      llmProvider: 'OMNIROUTE',
      primaryModel: 'auto',
      fallbackModel: 'llama-3.3-70b-groq',
      temperature: 0.1,
      customSystemPrompt: 'Você é o QA & DevOps Specialist. Execute e repare testes com automação rigorosa e gere relatórios de cobertura.',
    },
  ];

  for (const specialist of specialistConfigs) {
    await prisma.specialistAgentConfig.upsert({
      where: { role: specialist.role },
      update: specialist,
      create: specialist,
    });
  }
  console.log(`✅ ${specialistConfigs.length} configurações da Squad Especialista populadas.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
