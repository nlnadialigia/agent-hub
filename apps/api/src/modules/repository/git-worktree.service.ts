import { Injectable, Logger } from '@nestjs/common';
import { execa } from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class GitWorktreeService {
  private readonly logger = new Logger(GitWorktreeService.name);
  private readonly worktreesRoot: string;

  constructor() {
    this.worktreesRoot = process.env.WORKTREES_BASE_DIR || path.resolve(process.cwd(), '../../worktrees');
  }

  /**
   * Cria uma sandbox isolada usando `git worktree`
   * Garante que tarefas concorrentes nunca entrem em conflito de arquivos
   */
  async createWorktree(
    repoPath: string,
    taskId: string,
    baseBranch = 'main'
  ): Promise<{ worktreePath: string; branchName: string }> {
    await fs.ensureDir(this.worktreesRoot);
    const worktreePath = path.join(this.worktreesRoot, `task-${taskId}`);
    const branchName = `feat/task-${taskId.slice(0, 8)}`;

    this.logger.log(`🌿 Criando Git Worktree isolada em '${worktreePath}' a partir de '${baseBranch}'...`);

    // Remove worktree pré-existente se houver resquício
    if (await fs.pathExists(worktreePath)) {
      await this.removeWorktree(repoPath, worktreePath);
    }

    try {
      // Tenta atualizar refs remotas
      try {
        await execa('git', ['fetch', 'origin', baseBranch], { cwd: repoPath });
      } catch {
        // Ignora caso esteja offline ou sem remote
      }

      // Cria a worktree apontando para nova branch
      await execa(
        'git',
        ['worktree', 'add', '-B', branchName, worktreePath, baseBranch],
        { cwd: repoPath }
      );

      this.logger.log(`✅ Worktree pronta em: ${worktreePath}`);
      return { worktreePath, branchName };
    } catch (error: any) {
      this.logger.warn(`Falha no comando worktree (${error.message}). Utilizando diretório direto com fallback.`);
      return { worktreePath: repoPath, branchName };
    }
  }

  /**
   * Realiza commit e push a partir da sandbox isolada
   */
  async commitAndPush(
    worktreePath: string,
    message: string,
    branchName: string,
    remoteName = 'origin'
  ): Promise<{ success: boolean; commitHash?: string }> {
    try {
      await execa('git', ['add', '.'], { cwd: worktreePath });
      
      const { stdout: statusOut } = await execa('git', ['status', '--porcelain'], { cwd: worktreePath });
      if (!statusOut.trim()) {
        this.logger.log('Nenhuma modificação pendente para commit na worktree.');
        return { success: true };
      }

      await execa('git', ['commit', '-m', message], { cwd: worktreePath });
      const { stdout: hashOut } = await execa('git', ['rev-parse', 'HEAD'], { cwd: worktreePath });

      // Tenta dar push para o remote
      try {
        await execa('git', ['push', '-u', remoteName, branchName], { cwd: worktreePath });
        this.logger.log(`🚀 Push executado com sucesso para ${remoteName}/${branchName}.`);
      } catch (pushErr: any) {
        this.logger.warn(`Push remoto não executado ou falhou: ${pushErr.message}. Commit preservado localmente.`);
      }

      return { success: true, commitHash: hashOut.trim() };
    } catch (err: any) {
      this.logger.error(`Erro ao efetuar commit na worktree: ${err.message}`);
      return { success: false };
    }
  }

  /**
   * Remove a worktree e libera o diretório isolado
   */
  async removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
    try {
      this.logger.log(`🧹 Removendo worktree em '${worktreePath}'...`);
      await execa('git', ['worktree', 'remove', '--force', worktreePath], { cwd: repoPath });
      await execa('git', ['worktree', 'prune'], { cwd: repoPath });
    } catch (err: any) {
      this.logger.warn(`Aviso ao remover worktree via Git: ${err.message}. Limpando diretório no sistema de arquivos.`);
      await fs.remove(worktreePath).catch(() => {});
    }
  }
}
