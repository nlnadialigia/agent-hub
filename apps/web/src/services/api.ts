import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3334';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
});

export const AgentHubApi = {
  // Repositórios
  getRepositories: async () => {
    const res = await api.get('/repositories');
    return res.data;
  },
  scanRepository: async (path: string, name?: string, forceScan = false) => {
    const res = await api.post('/repositories/scan', { path, name, forceScan });
    return res.data;
  },
  updateTargetBranch: async (id: string, targetBranch: string) => {
    const res = await api.patch(`/repositories/${id}/target-branch`, { targetBranch });
    return res.data;
  },

  // Tarefas & Squad
  createTask: async (payload: {
    cardId: string;
    repositoryId?: string;
    taskProvider?: string;
    vcsProvider?: string;
    targetBranch?: string;
    executionMode?: 'SEQUENTIAL' | 'CONCURRENT';
    customInstructions?: string;
  }) => {
    const res = await api.post('/squad/tasks', payload);
    return res.data;
  },
  getTasks: async (includeArchived = false) => {
    const res = await api.get(`/squad/tasks?includeArchived=${includeArchived}`);
    return res.data;
  },
  getTask: async (id: string) => {
    const res = await api.get(`/squad/tasks/${id}`);
    return res.data;
  },
  archiveTask: async (id: string) => {
    const res = await api.patch(`/squad/tasks/${id}/archive`);
    return res.data;
  },
  restoreTask: async (id: string) => {
    const res = await api.patch(`/squad/tasks/${id}/restore`);
    return res.data;
  },

  // OmniRoute & Modelos
  getOmniHealth: async () => {
    const res = await api.get('/omniroute/health');
    return res.data;
  },
  getAllowedModels: async () => {
    const res = await api.get('/omniroute/models');
    return res.data;
  },
  syncFreeModels: async () => {
    const res = await api.post('/omniroute/models/sync-free');
    return res.data;
  },
  getSquadSpecialists: async () => {
    const res = await api.get('/omniroute/squad');
    return res.data;
  },
  updateSpecialist: async (role: string, data: any) => {
    const res = await api.put(`/omniroute/squad/${role}`, data);
    return res.data;
  },

  // Cofre de Credenciais
  getConnections: async () => {
    const res = await api.get('/vault/connections');
    return res.data;
  },
  saveConnection: async (payload: {
    category: 'TASK_PROVIDER' | 'VCS_PROVIDER' | 'LLM_PROVIDER';
    providerType: string;
    name: string;
    config: Record<string, any>;
    isDefault?: boolean;
  }) => {
    const res = await api.post('/vault/connections', payload);
    return res.data;
  },
  deleteConnection: async (id: string) => {
    const res = await api.delete(`/vault/connections/${id}`);
    return res.data;
  },
  testConnection: async (payload: {
    category: 'TASK_PROVIDER' | 'VCS_PROVIDER';
    providerType: string;
    config?: Record<string, string>;
  }) => {
    const res = await api.post('/providers/test-connection', payload);
    return res.data;
  },
  fetchCardPreview: async (providerType: string, cardId: string) => {
    const res = await api.post('/providers/fetch-card', { providerType, cardId });
    return res.data;
  },
};
