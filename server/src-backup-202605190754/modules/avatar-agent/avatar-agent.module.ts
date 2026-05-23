// @ts-nocheck
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
} from './tools/platform-publish-tools'
import {
  QueryUserProfileTool,
  QueryOrdersTool
} from './tools/data-tools'
import {
  AvatarSendMessageTool,
  AvatarCreateMomentTool
} from './tools/social-tools'
import {
  CreateTaskTool,
  UpdateTaskTool,
  QueryTasksTool
} from './tools/task-tools'
import {
  ChangePasswordTool
} from './tools/user-management-tools'
import {
  QueryAvatarFriendsTool,
  AddAvatarFriendTool,
  RemoveAvatarFriendTool
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
    // 内容创作工具
    WriteWechatMpArticleTool,
    WriteXiaohongshuNoteTool,
    WriteWechatMomentsTool,
    // 内容生成工具
    ContentGenerateImageTool,
    GenerateVideoTool,
    // 发布工具
    PublishWechatMpTool,
    // 数据查询工具
    QueryUserProfileTool,
    QueryOrdersTool,
    // 社交工具
    AvatarSendMessageTool,
    AvatarCreateMomentTool,
    // 任务工具
    CreateTaskTool,
    UpdateTaskTool,
    QueryTasksTool,
    // 用户管理工具
    ChangePasswordTool,
    // 分身管理工具
    QueryAvatarFriendsTool,
    AddAvatarFriendTool,
    RemoveAvatarFriendTool,
  ],
  exports: [AvatarAgentService]
})
export class AvatarAgentModule {}
