import { Controller, Post, Get, Put, Delete, Body, Param, Query, Headers } from '@nestjs/common'
import { TaskService } from './task.service'

@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async createTask(
    @Headers('x-user-id') userId: string,
    @Body() body: any
  ) {
    console.log('创建任务请求:', { userId, body })
    
    const task = await this.taskService.createTask(userId, body)
    
    return {
      code: 200,
      msg: '创建成功',
      data: task
    }
  }

  @Get()
  async getTasks(
    @Headers('x-user-id') userId: string,
    @Query('status') status?: string
  ) {
    const tasks = await this.taskService.getTasksByUser(userId, status)
    
    return {
      code: 200,
      data: tasks
    }
  }

  @Get('stats')
  async getTaskStats(@Headers('x-user-id') userId: string) {
    const stats = await this.taskService.getTaskStats(userId)
    
    return {
      code: 200,
      data: stats
    }
  }

  @Get(':id')
  async getTask(
    @Headers('x-user-id') userId: string,
    @Param('id') taskId: string
  ) {
    const task = await this.taskService.getTaskById(taskId, userId)
    
    return {
      code: 200,
      data: task
    }
  }

  @Post(':id/execute')
  async executeTask(
    @Headers('x-user-id') userId: string,
    @Param('id') taskId: string
  ) {
    console.log('执行任务请求:', { taskId, userId })
    
    const result = await this.taskService.executeTask(taskId, userId)
    
    return {
      code: 200,
      msg: '任务执行完成',
      data: result
    }
  }

  @Put(':id')
  async updateTask(
    @Headers('x-user-id') userId: string,
    @Param('id') taskId: string,
    @Body() body: any
  ) {
    const task = await this.taskService.updateTask(taskId, userId, body)
    
    return {
      code: 200,
      msg: '更新成功',
      data: task
    }
  }

  @Post(':id/cancel')
  async cancelTask(
    @Headers('x-user-id') userId: string,
    @Param('id') taskId: string
  ) {
    const task = await this.taskService.cancelTask(taskId, userId)
    
    return {
      code: 200,
      msg: '任务已取消',
      data: task
    }
  }

  @Delete(':id')
  async deleteTask(
    @Headers('x-user-id') userId: string,
    @Param('id') taskId: string
  ) {
    await this.taskService.deleteTask(taskId, userId)
    
    return {
      code: 200,
      msg: '删除成功'
    }
  }
}
