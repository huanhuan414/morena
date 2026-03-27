import { Controller, Get, Post, Put, Delete, Body, Param, Headers, Query } from '@nestjs/common'
import { TaskService } from './task.service'

@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() taskData: Record<string, any>
  ) {
    const task = await this.taskService.createTask(userId, taskData)
    return {
      code: 200,
      data: task,
      message: '创建成功'
    }
  }

  @Get()
  async list(
    @Headers('x-user-id') userId: string,
    @Query('status') status?: string
  ) {
    const tasks = await this.taskService.getTasks(userId, status)
    return {
      code: 200,
      data: tasks,
      message: '获取成功'
    }
  }

  @Get('stats')
  async stats(@Headers('x-user-id') userId: string) {
    const stats = await this.taskService.getTaskStats(userId)
    return {
      code: 200,
      data: stats,
      message: '获取成功'
    }
  }

  @Get(':id')
  async get(@Param('id') taskId: string) {
    const task = await this.taskService.getTaskById(taskId)
    return {
      code: 200,
      data: task,
      message: '获取成功'
    }
  }

  @Put(':id/progress')
  async updateProgress(
    @Param('id') taskId: string,
    @Body('progress') progress: number,
    @Body('status') status?: string
  ) {
    const task = await this.taskService.updateTaskProgress(taskId, progress, status)
    return {
      code: 200,
      data: task,
      message: '更新成功'
    }
  }

  @Put(':id/result')
  async updateResult(
    @Param('id') taskId: string,
    @Body('result') result: Record<string, any>
  ) {
    const task = await this.taskService.updateTaskResult(taskId, result)
    return {
      code: 200,
      data: task,
      message: '更新成功'
    }
  }

  @Put(':id/cancel')
  async cancel(
    @Param('id') taskId: string,
    @Headers('x-user-id') userId: string
  ) {
    const task = await this.taskService.cancelTask(taskId, userId)
    return {
      code: 200,
      data: task,
      message: '取消成功'
    }
  }

  @Put(':id/retry')
  async retry(@Param('id') taskId: string) {
    const task = await this.taskService.retryTask(taskId)
    return {
      code: 200,
      data: task,
      message: '重试成功'
    }
  }
}
