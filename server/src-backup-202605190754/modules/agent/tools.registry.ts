import { Injectable } from '@nestjs/common'
import { ITool, ToolContext, ToolResult, ToolCallRequest, ToolExecutionContext } from './tools.interface'
import { SearchTool } from './tools/search.tool'
import { SendMessageTool } from './tools/send-message.tool'
import { CreateDocumentTool } from './tools/create-document.tool'
import { QueryDataTool } from './tools/query-data.tool'
import { GenerateImageTool } from './tools/generate-image.tool'
import { GenerateVideoTool } from './tools/generate-video.tool'

// Helper to extract tool name from definition
const getToolName = (tool: any): string => {
  return tool.definition?.name || tool.name
}

// Helper to extract tool properties from definition
const getToolProps = (tool: any): any => {
  if (tool.definition) {
    return {
      name: tool.definition.name,
      description: tool.definition.description,
      parameters: tool.definition.paramsSchema || {}
    }
  }
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters || {}
  }
}

@Injectable()
export class ToolsRegistry {
  private tools: Map<string, ITool> = new Map()

  constructor(
    private readonly searchTool: SearchTool,
    private readonly sendMessageTool: SendMessageTool,
    private readonly createDocumentTool: CreateDocumentTool,
    private readonly queryDataTool: QueryDataTool,
    private readonly generateImageTool: GenerateImageTool,
    private readonly generateVideoTool: GenerateVideoTool
  ) {
    // 注册所有工具
    this.register(searchTool)
    this.register(sendMessageTool)
    this.register(createDocumentTool)
    this.register(queryDataTool)
    this.register(generateImageTool)
    this.register(generateVideoTool)
  }

  private register(tool: any) {
    const name = getToolName(tool)
    this.tools.set(name, tool)
    console.log(`[ToolsRegistry] 注册工具: ${name}`)
  }

  /**
   * 获取所有工具的定义（供 LLM 使用）
   */
  getToolsDefinition(): Array<{
    name: string
    description: string
    parameters: Record<string, any>
  }> {
    return Array.from(this.tools.values()).map(tool => getToolProps(tool))
  }

  /**
   * 执行工具调用
   */
  async executeTool(request: ToolCallRequest, context: ToolExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(request.tool)
    
    if (!tool) {
      return {
        success: false,
        error: `未知的工具: ${request.tool}`,
        message: `工具 "${request.tool}" 不存在`
      }
    }
    
    console.log(`[ToolsRegistry] 执行工具: ${request.tool}`, request.parameters)
    
    try {
      const result = await tool.execute(request.parameters || {}, context)
      console.log(`[ToolsRegistry] 工具执行结果:`, result.success ? '成功' : '失败')
      return result
    } catch (error) {
      console.error(`[ToolsRegistry] 工具执行异常:`, error)
      return {
        success: false,
        error: error.message,
        message: `工具执行失败: ${error.message}`
      }
    }
  }

  /**
   * 检查工具是否存在
   */
  hasTool(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 获取工具
   */
  getTool(name: string): ITool | undefined {
    return this.tools.get(name)
  }
}
