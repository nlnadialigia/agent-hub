import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { PolyglotScannerService } from './polyglot-scanner.service';

@Controller('repositories')
export class RepositoryController {
  constructor(private readonly scannerService: PolyglotScannerService) {}

  @Get()
  async listRepositories() {
    return this.scannerService.listRepositories();
  }

  @Get('directories')
  async listMonitoredDirectories() {
    return this.scannerService.listMonitoredDirectories();
  }

  @Post('directories/:id/rescan')
  async rescanMonitoredDirectory(@Param('id') id: string) {
    return this.scannerService.rescanMonitoredDirectory(id);
  }

  @Delete('directories/:id')
  async deleteMonitoredDirectory(@Param('id') id: string) {
    return this.scannerService.deleteMonitoredDirectory(id);
  }

  @Post('scan')
  async scanRepository(
    @Body()
    body: {
      path: string;
      name?: string;
      forceScan?: boolean;
    }
  ) {
    return this.scannerService.scanRepository(body.path, body.name, body.forceScan);
  }

  @Post('scan-directory')
  async scanDirectory(
    @Body()
    body: {
      directoryPath: string;
    }
  ) {
    return this.scannerService.scanDirectory(body.directoryPath);
  }

  @Patch(':id/target-branch')
  async updateTargetBranch(
    @Param('id') id: string,
    @Body() body: { targetBranch: string }
  ) {
    return this.scannerService.updateRepositoryTargetBranch(id, body.targetBranch);
  }
}
