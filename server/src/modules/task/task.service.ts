import { Injectable } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class TaskService {
  /**
   * 创建任务
   */
  async createTask(userId: string, taskData: Record<string, any>) {
    const client = getSupabaseClient()
    
    // 获取分身信息
    const { data: avatar } = await client
      .from('avatars')
      .select('*')
      .eq('id', taskData.avatar_id)
      .eq('user_id', userId)
      .single()
    
    if (!avatar) {
      throw new Error('分身不存在')
    }
    
    // 创建任务
    const { data, error } = await client
      .from('tasks')
      .insert({
        user_id: userId,
        avatar_id: taskData.avatar_id,
        title: taskData.title,
        description: taskData.description,
        task_type: taskData.task_type || 'general',
        priority: taskData.priority || 'normal',
        status: 'pending',
        params: taskData.params || {},
        progress: 0,
        result: null,
        logs: [],
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建任务失败: ${error.message}`)
    }
    
    return data
  }

  /**
   * 获取用户的任务列表
   */
  async getTasksByUser(userId: string, status?: string) {
    const client = getSupabaseClient()
    
    let query = client
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    
    if (error) {
      throw new Error(`获取任务列表失败: ${error.message}`)
    }
    
    return data
  }

  /**
   * 获取任务详情
   */
  async getTaskById(taskId: string, userId?: string) {
    const client = getSupabaseClient()
    
    let query = client
      .from('tasks')
      .select('*')
      .eq('id', taskId)
    
    // 如果提供了userId，则添加过滤条件
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query.maybeSingle()
    
    if (error) {
      console.error('获取任务详情失败:', error)
      throw new Error(`获取任务详情失败: ${error.message}`)
    }
    
    if (!data) {
      throw new Error('任务不存在')
    }
    
    return data
  }

  /**
   * 开始执行任务 - AI Agent自动规划并执行
   */
  async executeTask(taskId: string, userId: string) {
    const client = getSupabaseClient()
    
    // 获取任务信息
    const task = await this.getTaskById(taskId, userId)
    
    if (!task) {
      throw new Error('任务不存在')
    }
    
    if (task.status !== 'pending') {
      throw new Error('任务状态不允许执行')
    }
    
    // 更新任务状态为执行中
    await client
      .from('tasks')
      .update({ 
        status: 'executing',
        started_at: new Date().toISOString()
      })
      .eq('id', taskId)
    
    // AI规划任务执行步骤
    const executionPlan = await this.planTaskExecution(task)
    
    // 记录规划日志
    await this.addTaskLog(taskId, 'planning', '任务规划完成', { plan: executionPlan })
    
    // 执行任务
    try {
      const result = await this.executePlan(taskId, task, executionPlan)
      
      // 更新任务完成状态
      await client
        .from('tasks')
        .update({
          status: 'completed',
          progress: 100,
          result: result,
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)
      
      // 给分身增加经验
      await this.addAvatarExperience(task.avatar_id, 10)
      
      await this.addTaskLog(taskId, 'completed', '任务执行完成', result)
      
      return { success: true, result }
    } catch (error) {
      // 更新任务失败状态
      await client
        .from('tasks')
        .update({
          status: 'failed',
          result: { error: error.message }
        })
        .eq('id', taskId)
      
      await this.addTaskLog(taskId, 'error', `任务执行失败: ${error.message}`)
      
      throw error
    }
  }

  /**
   * AI规划任务执行步骤
   */
  private async planTaskExecution(task: any) {
    const config = new Config()
    const llmClient = new LLMClient(config)
    
    const prompt = `你是一个任务规划专家。请为以下任务制定详细的执行计划：

任务信息：
- 标题：${task.title}
- 描述：${task.description || '无'}
- 类型：${task.task_type}
- 参数：${JSON.stringify(task.params || {})}

请将任务分解为3-5个具体步骤，每个步骤包含：
1. step: 步骤名称
2. action: 具体动作
3. expected_output: 预期输出

以JSON数组格式返回：
[
  { "step": "步骤1", "action": "具体动作", "expected_output": "预期输出" },
  ...
]`

    try {
      const response = await llmClient.invoke([
        { role: 'user' as const, content: prompt }
      ], {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.3
      })
      
      // 解析JSON
      const jsonMatch = response.content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      // 返回默认计划
      return this.getDefaultPlan(task)
    } catch (error) {
      console.error('规划失败:', error)
      return this.getDefaultPlan(task)
    }
  }

  /**
   * 获取默认执行计划
   */
  private getDefaultPlan(task: any) {
    const basePlans = {
      writing: [
        { step: '理解需求', action: '分析任务要求', expected_output: '需求理解报告' },
        { step: '构思框架', action: '设计内容结构', expected_output: '内容大纲' },
        { step: '撰写内容', action: '根据大纲写作', expected_output: '完整文本' },
        { step: '优化润色', action: '检查并优化', expected_output: '最终成果' }
      ],
      analysis: [
        { step: '数据收集', action: '获取相关数据', expected_output: '原始数据' },
        { step: '数据处理', action: '清洗整理数据', expected_output: '结构化数据' },
        { step: '深度分析', action: '执行分析方法', expected_output: '分析结果' },
        { step: '生成报告', action: '输出分析报告', expected_output: '完整报告' }
      ],
      research: [
        { step: '确定范围', action: '定义研究边界', expected_output: '研究框架' },
        { step: '信息检索', action: '收集相关信息', expected_output: '资料汇总' },
        { step: '分析综合', action: '整理分析资料', expected_output: '核心发现' },
        { step: '输出结论', action: '撰写研究结论', expected_output: '研究报告' }
      ],
      general: [
        { step: '理解任务', action: '分析任务目标', expected_output: '任务理解' },
        { step: '制定方案', action: '设计解决方案', expected_output: '执行方案' },
        { step: '执行实施', action: '完成核心工作', expected_output: '执行结果' },
        { step: '检查验收', action: '验证结果质量', expected_output: '最终成果' }
      ]
    }
    
    return basePlans[task.task_type] || basePlans.general
  }

  /**
   * 执行任务计划
   */
  private async executePlan(taskId: string, task: any, plan: any[]) {
    const config = new Config()
    const llmClient = new LLMClient(config)
    const results: { step: string; output: string }[] = []
    
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i]
      
      // 更新进度
      const progress = Math.round(((i + 1) / plan.length) * 100)
      await this.updateProgress(taskId, progress)
      
      await this.addTaskLog(taskId, 'step', `开始执行: ${step.step}`)
      
      // 使用LLM执行每个步骤
      const stepPrompt = `你是任务执行专家。现在执行以下步骤：

任务：${task.title}
步骤：${step.step}
具体动作：${step.action}
预期输出：${step.expected_output}

请直接输出执行结果，不要解释过程。`

      const response = await llmClient.invoke([
        { role: 'user' as const, content: stepPrompt }
      ], {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.7
      })
      
      results.push({
        step: step.step,
        output: response.content
      })
      
      await this.addTaskLog(taskId, 'step_complete', `完成: ${step.step}`, { output: response.content.substring(0, 200) })
    }
    
    return {
      steps: results,
      summary: results[results.length - 1]?.output || '任务完成',
      completedAt: new Date().toISOString()
    }
  }

  /**
   * 更新任务进度
   */
  private async updateProgress(taskId: string, progress: number) {
    const client = getSupabaseClient()
    
    await client
      .from('tasks')
      .update({ progress })
      .eq('id', taskId)
  }

  /**
   * 添加任务日志
   */
  private async addTaskLog(taskId: string, type: string, message: string, data?: any) {
    const client = getSupabaseClient()
    
    // 获取当前日志
    const { data: task } = await client
      .from('tasks')
      .select('logs')
      .eq('id', taskId)
      .single()
    
    const logs = task?.logs || []
    logs.push({
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    })
    
    // 更新日志
    await client
      .from('tasks')
      .update({ logs })
      .eq('id', taskId)
  }

  /**
   * 给分身增加经验
   */
  private async addAvatarExperience(avatarId: string, exp: number) {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('exp, level')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      const newExp = avatar.exp + exp
      const newLevel = Math.floor(newExp / 100) + 1
      
      await client
        .from('avatars')
        .update({
          exp: newExp,
          level: newLevel
        })
        .eq('id', avatarId)
    }
  }

  /**
   * 更新任务
   */
  async updateTask(taskId: string, userId: string, updates: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新任务失败: ${error.message}`)
    }
    
    return data
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`删除任务失败: ${error.message}`)
    }
    
    return { success: true }
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('tasks')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`取消任务失败: ${error.message}`)
    }
    
    return data
  }

  /**
   * 获取任务统计
   */
  async getTaskStats(userId: string) {
    const client = getSupabaseClient()
    
    const { data: tasks } = await client
      .from('tasks')
      .select('status, task_type')
      .eq('user_id', userId)
    
    const stats = {
      total: tasks?.length || 0,
      pending: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      byType: {}
    }
    
    tasks?.forEach(task => {
      stats[task.status] = (stats[task.status] || 0) + 1
      stats.byType[task.task_type] = (stats.byType[task.task_type] || 0) + 1
    })
    
    return stats
  }
}
