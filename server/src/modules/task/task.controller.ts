import { Controller, Post, Get, Put, Param, Body, Headers } from '@nestjs/common'
import { TaskService } from './task.service'

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async createTask(
    @Headers('x-user-id') userId: string,
    @Body() body: { type: string; avatar_id?: string; config?: Record<string, any> }
  ) {
    return await this.taskService.createTask(userId, body)
  }

  @Get()
  async getTasks(
    @Headers('x-user-id') userId: string,
    @Headers('x-task-status') status?: string
  ) {
    return await this.taskService.getTasks(userId, status)
  }

  @Get('stats')
  async getTaskStats(@Headers('x-user-id') userId: string) {
    return await this.taskService.getTaskStats(userId)
  }

  @Get(':id')
  async getTask(@Param('id') id: string) {
    return await this.taskService.getTask(id)
  }

  @Put(':id/status')
  async updateTaskStatus(
    @Param('id') id: string,
    @Body() body: { status: string; result?: Record<string, any> }
  ) {
    return await this.taskService.updateTaskStatus(id, body.status, body.result)
  }
}
