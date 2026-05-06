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
  WriteWechatMpArticleTool,
  WriteXiaohongshuNoteTool,
  WriteWechatMomentsTool
} from './tools/content-creation-tools'
import {
  GenerateImageTool as ContentGenerateImageTool,
  GenerateVideoTool
} from './tools/content-generation-tools'
import {
  PublishWechatMpTool,
  PublishXiaohongshuTool,
  PublishWechatVideoTool
} from './tools/platform-publish-tools'
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
import {
  QueryAvatarFriendsTool,
  AddAvatarFriendTool,
  RemoveAvatarFriendTool,
  QueryAvatarProfileTool
} from './tools/avatar-management-tools'

@Module({
  controllers: [AvatarAgentController],
  providers: [
    AvatarAgentService,
    AvatarMemoryService,
    AvatarLearningService,
    AvatarToolRegistry,
    // 原有内容创作工具
    WriteArticleTool,
    GenerateImageTool,
    SummarizeTool,
    // 内容创作工具（从旧系统迁移）
    WriteWechatMpArticleTool,
    WriteXiaohongshuNoteTool,
    WriteWechatMomentsTool,
    // 内容生成工具（从旧系统迁移）
    ContentGenerateImageTool,
    GenerateVideoTool,
    // 平台发布工具（从旧系统迁移）
    PublishWechatMpTool,
    PublishXiaohongshuTool,
    PublishWechatVideoTool,
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
    DeleteAccountTool,
    // 分身管理工具
    QueryAvatarFriendsTool,
    AddAvatarFriendTool,
    RemoveAvatarFriendTool,
    QueryAvatarProfileTool
  ],
  exports: [
    AvatarAgentService,
    AvatarMemoryService,
    AvatarLearningService,
    AvatarToolRegistry
  ]
})
export class AvatarAgentModule {}
