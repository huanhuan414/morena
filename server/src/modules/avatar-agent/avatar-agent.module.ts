/**
 * Avatar Agent Module
 * 分身 Agent 模块
 */

import { Module } from '@nestjs/common'
import { AvatarAgentController } from './avatar-agent.controller'
import { AvatarAgentService } from './avatar-agent.service'
import { AvatarMemoryService } from './avatar-memory.service'
import { AvatarLearningService } from './avatar-learning.service'
import { AvatarToolRegistry } from './tools/tool-registry'

// 导入所有工具
import {
  WriteArticleTool,
  GenerateImageTool,
  SummarizeTool
} from './tools/content-tools'
import {
  QueryUserProfileTool,
  QueryOrdersTool,
  QueryFriendsTool
} from './tools/data-tools'
import {
  SendMessageTool,
  CreateMomentTool,
  AddCommentTool
} from './tools/social-tools'
import {
  CreateTaskTool,
  UpdateTaskStatusTool,
  QueryTasksTool,
  AssignTaskTool
} from './tools/task-tools'
import {
  ChangePasswordTool,
  UpdateProfileTool,
  UploadAvatarTool,
  BindPhoneTool,
  DeleteAccountTool
} from './tools/user-management-tools'

@Module({
  controllers: [AvatarAgentController],
  providers: [
    AvatarAgentService,
    AvatarMemoryService,
    AvatarLearningService,
    AvatarToolRegistry,
    // 内容创作工具
    WriteArticleTool,
    GenerateImageTool,
    SummarizeTool,
    // 数据查询工具
    QueryUserProfileTool,
    QueryOrdersTool,
    QueryFriendsTool,
    // 社交互动工具
    SendMessageTool,
    CreateMomentTool,
    AddCommentTool,
    // 任务管理工具
    CreateTaskTool,
    UpdateTaskStatusTool,
    QueryTasksTool,
    AssignTaskTool,
    // 用户管理工具
    ChangePasswordTool,
    UpdateProfileTool,
    UploadAvatarTool,
    BindPhoneTool,
    DeleteAccountTool
  ],
  exports: [
    AvatarAgentService,
    AvatarMemoryService,
    AvatarLearningService,
    AvatarToolRegistry
  ]
})
export class AvatarAgentModule {}
