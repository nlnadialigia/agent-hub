export interface SubtaskItem {
  id: string;
  title: string;
  isFinished: boolean;
}

export interface TaskCard {
  cardId: string;
  title: string;
  description: string;
  tags?: string[];
  boardId?: string | number;
  subtasks?: SubtaskItem[];
  metadata?: Record<string, any>;
}

export interface ITaskProvider {
  readonly providerType: string;
  fetchTask(cardId: string, config: Record<string, string>): Promise<TaskCard>;
  createSubtask?(cardId: string, title: string, config: Record<string, string>): Promise<{ id: string; title: string }>;
  completeSubtask?(cardId: string, subtaskId: string, config: Record<string, string>): Promise<boolean>;
  testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }>;
}
