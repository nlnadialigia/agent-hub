import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

export type HumanDecision =
  | { action: 'APPROVE' }
  | { action: 'REJECT' }
  | { action: 'REFINE'; feedback: string };

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AgentGateway.name);
  private decisionResolvers = new Map<string, (decision: HumanDecision) => void>();

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado via WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  /**
   * Envia mensagem de log em tempo real com identificador do especialista
   */
  emitLog(
    taskId: string,
    message: string,
    type: 'info' | 'warn' | 'error' | 'success' = 'info',
    specialistBadge?: string
  ) {
    if (this.server) {
      this.server.emit('task:log', {
        taskId,
        message,
        type,
        specialistBadge: specialistBadge || '🤖 Squad',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Atualiza status da tarefa em tempo real
   */
  emitStatus(taskId: string, status: string, metadata?: any) {
    if (this.server) {
      this.server.emit('task:status', {
        taskId,
        status,
        metadata,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Solicita decisão humana (Aprovar, Rejeitar ou Refinar com Feedback)
   */
  requestDecision(taskId: string, diagnostic: string, timeoutMs = 900000): Promise<HumanDecision> {
    return new Promise((resolve) => {
      this.emitStatus(taskId, 'WAITING_APPROVAL', { diagnostic });
      if (this.server) {
        this.server.emit('task:approval_required', { taskId, diagnostic });
      }

      this.decisionResolvers.set(taskId, resolve);

      // Timeout de segurança (15 minutos)
      setTimeout(() => {
        if (this.decisionResolvers.has(taskId)) {
          this.logger.warn(`Decisão expirou por timeout para tarefa ${taskId}`);
          this.decisionResolvers.delete(taskId);
          resolve({ action: 'REJECT' });
        }
      }, timeoutMs);
    });
  }

  @SubscribeMessage('task:respond_approval')
  handleApprovalResponse(client: Socket, payload: { taskId: string; approved: boolean }) {
    this.logger.log(`Resposta de aprovação booleana recebida para ${payload.taskId}: ${payload.approved}`);
    const resolver = this.decisionResolvers.get(payload.taskId);
    if (resolver) {
      resolver(payload.approved ? { action: 'APPROVE' } : { action: 'REJECT' });
      this.decisionResolvers.delete(payload.taskId);
    }
  }

  @SubscribeMessage('task:respond_decision')
  handleDecisionResponse(client: Socket, payload: { taskId: string; decision: HumanDecision }) {
    this.logger.log(`Decisão humana detalhada recebida para ${payload.taskId}: ${payload.decision?.action}`);
    const resolver = this.decisionResolvers.get(payload.taskId);
    if (resolver) {
      resolver(payload.decision);
      this.decisionResolvers.delete(payload.taskId);
    }
  }
}
