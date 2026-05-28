import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import * as lark from '@larksuiteoapi/node-sdk';
import { ConfigService } from '@nestjs/config';
import { GroupBotService } from '../group-bot.service';

@Injectable()
export class FeishuService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FeishuService.name);
  private client: lark.Client;
  private wsClient: lark.WSClient;
  private isConnected = false;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => GroupBotService))
    private groupBotService: GroupBotService,
  ) {
    const appId = this.configService.get<string>('FEISHU_APP_ID');
    const appSecret = this.configService.get<string>('FEISHU_APP_SECRET');

    if (!appId || !appSecret) {
      this.logger.warn('飞书配置缺失，跳过初始化');
      return;
    }

    // 创建API客户端
    this.client = new lark.Client({
      appId,
      appSecret,
      domain: lark.Domain.Feishu,
    });

    // 创建WebSocket客户端
    this.wsClient = new lark.WSClient({
      appId,
      appSecret,
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.info,
    });

    this.logger.log('飞书客户端初始化完成');
  }

  async onModuleInit() {
    const appId = this.configService.get<string>('FEISHU_APP_ID');
    if (!appId) return;

    try {
      await this.startWebSocket();
    } catch (error) {
      this.logger.error(`飞书WebSocket启动失败: ${error.message}`);
    }
  }

  onModuleDestroy() {
    this.isConnected = false;
    this.logger.log('飞书服务已销毁');
  }

  /**
   * 启动WebSocket长连接，接收飞书事件
   */
  async startWebSocket() {
    if (!this.wsClient) return;

    this.logger.log('正在启动飞书WebSocket长连接...');

    // 注册事件处理器
    this.wsClient.start({
      // 接收消息事件
      eventDispatcher: new lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data) => {
          await this.handleMessage(data);
        },
      }),
    });

    this.isConnected = true;
    this.logger.log('飞书WebSocket长连接已建立');
  }

  /**
   * 处理收到的飞书消息
   */
  private async handleMessage(data: any) {
    try {
      const message = data?.message;
      const sender = data?.sender;

      if (!message || !sender) {
        this.logger.warn('收到无效消息数据');
        return;
      }

      const chatId = message.chat_id;
      const chatType = message.chat_type; // p2p(单聊) / group(群聊)
      const msgType = message.message_type; // text / image / etc
      const msgId = message.message_id;
      const content = message.content;

      // 忽略非文本消息
      if (msgType !== 'text') {
        this.logger.log(`忽略非文本消息: ${msgType}`);
        return;
      }

      // 解析消息文本
      let text = '';
      try {
        const contentObj = JSON.parse(content);
        text = contentObj.text || '';
      } catch {
        text = content;
      }

      // 去掉@机器人的部分
      text = text.replace(/@_user_\d+/g, '').trim();

      if (!text) return;

      // 获取发送者信息
      const senderId = sender.sender_id?.user_id || sender.sender_id?.open_id || 'unknown';
      const senderName = await this.getUserName(senderId);

      this.logger.log(`收到飞书消息 [${chatType}] ${senderName}: ${text}`);

      // 只处理群聊消息
      if (chatType === 'group') {
        await this.handleGroupMessage(chatId, senderName, text, msgId);
      } else if (chatType === 'p2p') {
        // 单聊也处理
        await this.handleP2PMessage(chatId, senderName, text, msgId);
      }
    } catch (error) {
      this.logger.error(`处理飞书消息失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 处理群聊消息
   */
  private async handleGroupMessage(chatId: string, senderName: string, text: string, msgId: string) {
    // 查找这个群对应的分身配置
    const groupConfig = await this.findGroupByChatId(chatId);

    if (!groupConfig) {
      this.logger.log(`群 ${chatId} 未配置分身值守，跳过`);
      return;
    }

    if (groupConfig.status !== 'active') {
      this.logger.log(`群 ${chatId} 分身值守已暂停，跳过`);
      return;
    }

    // 调用GroupBotService生成分身回复
    const reply = await this.groupBotService.generateFeishuReply(
      text,
      senderName,
      groupConfig.avatarId,
    );

    if (reply) {
      // 发送回复到飞书群
      await this.sendGroupMessage(chatId, reply);

      // 记录消息到本地
      await this.groupBotService.recordFeishuMessage(
        groupConfig.id,
        senderName,
        text,
        reply,
      );

      this.logger.log(`分身回复已发送到群 ${chatId}`);
    }
  }

  /**
   * 处理单聊消息
   */
  private async handleP2PMessage(chatId: string, senderName: string, text: string, msgId: string) {
    // 单聊默认使用第一个活跃分身
    const reply = await this.groupBotService.generateFeishuReply(
      text,
      senderName,
      null, // 使用默认分身
    );

    if (reply) {
      await this.sendP2PMessage(chatId, reply);
      this.logger.log(`分身回复已发送给 ${senderName}`);
    }
  }

  /**
   * 发送消息到群聊
   */
  async sendGroupMessage(chatId: string, text: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const res = await this.client.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        },
      });

      this.logger.log(`消息已发送到群 ${chatId}, msgId: ${res.data?.message_id}`);
      return res.data?.message_id || null;
    } catch (error) {
      this.logger.error(`发送群消息失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 发送单聊消息
   */
  async sendP2PMessage(chatId: string, text: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const res = await this.client.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        },
      });

      return res.data?.message_id || null;
    } catch (error) {
      this.logger.error(`发送单聊消息失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取用户名称
   */
  private async getUserName(userId: string): Promise<string> {
    if (!this.client) return userId;

    try {
      const res = await this.client.contact.user.get({
        params: { user_id_type: 'user_id' },
        path: { user_id: userId },
      });

      return res.data?.user?.name || userId;
    } catch {
      return userId;
    }
  }

  /**
   * 根据飞书chatId查找本地群配置
   */
  private async findGroupByChatId(chatId: string) {
    return this.groupBotService.findGroupByPlatformChatId('feishu', chatId);
  }

  /**
   * 获取飞书群列表
   */
  async getGroupList(pageSize: number = 20, pageToken?: string) {
    if (!this.client) return { items: [] };

    try {
      const res = await this.client.im.chat.list({
        params: { page_size: pageSize, page_token: pageToken },
      });

      return {
        items: res.data?.items || [],
        hasMore: res.data?.has_more || false,
        pageToken: res.data?.page_token,
      };
    } catch (error) {
      this.logger.error(`获取飞书群列表失败: ${error.message}`);
      return { items: [] };
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      appId: this.configService.get<string>('FEISHU_APP_ID')?.substring(0, 10) + '...',
    };
  }
}
