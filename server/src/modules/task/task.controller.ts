import { Inject, Controller, Post, Get, Put, Param, Body, Headers } from '@nestjs/common'
import { TaskService } from './task.service'
import { requireAuthenticatedUserId } from '../../common/auth-user.util'

@Controller('tasks')
export class TaskController {
  constructor(@Inject(TaskService) private readonly taskService: TaskService) {}

  @Post()
  async createTask(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { type: string; avatar_id?: string; config?: Record<string, any> }
  ) {
    const userId = requireAuthenticatedUserId(headers)
    return await this.taskService.createTask(userId, body)
  }

  @Get()
  async getTasks(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Headers('x-task-status') status?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    return await this.taskService.getTasks(userId, status)
  }

  @Get('stats')
  async getTaskStats(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    return await this.taskService.getTaskStats(userId)
  }

  @Get(':id')
  async getTask(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    return await this.taskService.getTask(userId, id)
  }

  @Put(':id/status')
  async updateTaskStatus(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { status: string; result?: Record<string, any> }
  ) {
    const userId = requireAuthenticatedUserId(headers)
    return await this.taskService.updateTaskStatus(userId, id, body.status, body.result)
  }
}
