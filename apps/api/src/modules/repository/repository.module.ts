import { Module } from '@nestjs/common';
import { PolyglotScannerService } from './polyglot-scanner.service';
import { GitWorktreeService } from './git-worktree.service';
import { RepositoryController } from './repository.controller';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [RepositoryController],
  providers: [PolyglotScannerService, GitWorktreeService],
  exports: [PolyglotScannerService, GitWorktreeService],
})
export class RepositoryModule {}
