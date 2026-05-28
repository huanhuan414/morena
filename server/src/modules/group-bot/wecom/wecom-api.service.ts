/**
 * 企业微信 API 客户端
 * 用于获取 access_token 和发送消息
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface AccessTokenResponse {
  errcode: number;
  errmsg: string;
  access_token: string;
  expires_in: number;
}

interface SendMessageResponse {
  errcode: number;
  errmsg: string;
  invaliduser?: string;
  invalidparty?: string;
}

@Injectable()
export class WecomApiService {
  private readonly logger = new Logger(WecomApiService.name);
  private accessToken: string = '';
  private tokenExpiresAt: number = 0;

  constructor(private configService: ConfigService) {}

  private get corpId(): string {
    return this.configService.get<string>('WECOM_CORP_ID', '');
  }

  private get secret(): string {
    return this.configService.get<string>('WECOM_SECRET', '');
  }

  private get agentId(): number {
    return Number(this.configService.get<string>('WECOM_AGENT_ID', '0'));
  }

  /**
   * 获取 access_token（带缓存，有效期7200秒，提前5分钟刷新）
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${this.secret}`;
    console.log(`[WecomApi] 获取 access_token, corpId=${this.corpId}`);

    try {
      const response = await axios.get<AccessTokenResponse>(url);
      const data = response.data;

      if (data.errcode !== 0) {
        throw new Error(`获取 access_token 失败: errcode=${data.errcode}, errmsg=${data.errmsg}`);
      }

      this.accessToken = data.access_token;
      // 提前5分钟过期
      this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

      console.log(`[WecomApi] access_token 获取成功, 过期时间: ${new Date(this.tokenExpiresAt).toISOString()}`);
      return this.accessToken;
    } catch (error) {
      this.logger.error(`获取 access_token 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 发送文本消息给用户
   */
  async sendTextMessage(userId: string, content: string): Promise<SendMessageResponse> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;

    const body = {
      touser: userId,
      msgtype: 'text',
      agentid: this.agentId,
      text: {
        content,
      },
    };

    console.log(`[WecomApi] 发送消息给用户 ${userId}, 内容: ${content.substring(0, 50)}...`);

    try {
      const response = await axios.post<SendMessageResponse>(url, body);
      const data = response.data;

      if (data.errcode !== 0) {
        this.logger.error(`发送消息失败: errcode=${data.errcode}, errmsg=${data.errmsg}`);
      }

      return data;
    } catch (error) {
      this.logger.error(`发送消息异常: ${error.message}`);
      throw error;
    }
  }

  /**
   * 发送文本消息到群聊（通过 appchat）
   * 需要群是应用创建的群，或者应用在群内
   */
  async sendAppchatMessage(chatId: string, content: string): Promise<SendMessageResponse> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${token}`;

    const body = {
      chatid: chatId,
      msgtype: 'text',
      text: {
        content,
      },
      safe: 0,
    };

    console.log(`[WecomApi] 发送消息到群 ${chatId}, 内容: ${content.substring(0, 50)}...`);

    try {
      const response = await axios.post<SendMessageResponse>(url, body);
      const data = response.data;

      if (data.errcode !== 0) {
        this.logger.error(`发送群消息失败: errcode=${data.errcode}, errmsg=${data.errmsg}`);
      }

      return data;
    } catch (error) {
      this.logger.error(`发送群消息异常: ${error.message}`);
      throw error;
    }
  }
}
