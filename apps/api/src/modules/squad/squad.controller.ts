import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { SquadRunnerService, CreateTaskDto } from './squad-runner.service';

@Controller('squad/tasks')
export class SquadController {
  constructor(private readonly squadRunner: SquadRunnerService) {}

  @Post()
  async createTask(@Body() body: CreateTaskDto) {
    return this.squadRunner.createTask(body);
  }

  @Get()
  async listTasks(@Query('includeArchived') includeArchived?: string) {
    return this.squadRunner.listTasks(includeArchived === 'true');
  }

  @Get(':id')
  async getTask(@Param('id') id: string) {
    return this.squadRunner.getTask(id);
  }

  @Patch(':id/archive')
  async archiveTask(@Param('id') id: string) {
    return this.squadRunner.archiveTask(id);
  }

  @Patch(':id/restore')
  async restoreTask(@Param('id') id: string) {
    return this.squadRunner.restoreTask(id);
  }
}
