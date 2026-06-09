// @ts-nocheck
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import * as crypto from "crypto";
import { getMySQLClient } from "../../storage/database/mysql-client";
import { AuthSmsService } from "./sms.service";
import { ReferralService } from "../referral/referral.service";

@Injectable()
export class AuthService {
  private codeCache = new Map<string, { code: string; expiresAt: number }>();
  private accessTokenCache: { token: string; expiresAt: number } | null = null;
  constructor(
    @Inject("AUTH_SMS_SERVICE") private readonly smsService: AuthSmsService,
    private readonly referralService: ReferralService,
  ) {}

  /**
   * 发送验证码
   */
  async sendVerificationCode(
    phone: string,
  ): Promise<{ success: boolean; message: string; code?: string }> {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException("请输入正确的手机号");
    }

    const cached = this.codeCache.get(phone);
    if (cached && cached.expiresAt > Date.now() + 4 * 60 * 1000) {
      const remainingTime = Math.ceil(
        (cached.expiresAt - 4 * 60 * 1000 - Date.now()) / 1000,
      );
      if (remainingTime > 0) {
        throw new BadRequestException(`${remainingTime}秒后可重新发送`);
      }
    }

    const code = this.smsService.generateCode();
    this.codeCache.set(phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    const result = await this.smsService.sendVerificationCode(phone, code);
    if (result.success && result.isDev) {
      return { ...result, code };
    }

    return result;
  }

  /**
   * 手机号验证码登录/注册
   * 如果用户不存在则自动注册
   * 支持邀请码参数，注册成功后自动发放邀请奖励
   * 支持设备ID和IP地址记录
   */
  async phoneLogin(
    phone: string,
    code: string,
    nickname?: string,
    referralCode?: string,
    deviceId?: string,
    ipAddress?: string,
  ): Promise<{
    user: any;
    isNewUser: boolean;
    token: string;
    referralReward?: number;
  }> {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException("请输入正确的手机号");
    }

    const cached = this.codeCache.get(phone);
    if (!cached) {
      throw new BadRequestException("请先获取验证码");
    }

    if (cached.expiresAt < Date.now()) {
      this.codeCache.delete(phone);
      throw new BadRequestException("验证码已过期，请重新获取");
    }

    if (cached.code !== code) {
      throw new BadRequestException("验证码错误");
    }

    this.codeCache.delete(phone);
    const db = getMySQLClient();
    const result = await db.query("users", { phone });
    const existingUser = Array.isArray(result)
      ? result[0]
      : (result as any)?.data?.[0];
    if (existingUser) {
      // 更新最后登录IP
      if (ipAddress) {
        try {
          await db.updateWhere('users', { id: existingUser.id }, {
            last_login_ip: ipAddress,
            updated_at: new Date()
          })
        } catch (err) {
          console.error('[AuthService] 更新登录IP失败:', err)
        }
      }
      return {
        user: existingUser,
        isNewUser: false,
        token: this.generateToken(existingUser.id),
      };
    }

    const userId = require("uuid").v4();
    const newUserData = {
      id: userId,
      phone,
      openid: `phone_${phone}`,
      nickname: nickname || `用户${phone.slice(-4)}`,
      avatar: "",
      level: 1,
      exp: 0,
      credits: 100,
      referral_code: this.generateReferralCode(),
      device_id: deviceId || null,
      ip_address: ipAddress || null,
      last_login_ip: ipAddress || null,
      created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    const insertResult = await db.insert("users", newUserData);
    if (insertResult.error) {
      throw new Error(`创建用户失败: ${insertResult.error.message}`);
    }

    const newUserResult = await db.query("users", { phone });
    const newUser = Array.isArray(newUserResult)
      ? newUserResult[0]
      : (newUserResult as any)?.data?.[0];
    if (!newUser) {
      throw new Error("创建用户失败：未返回用户数据");
    }

    let referralReward = 0;
    if (referralCode && newUser) {
      try {
        const referralResult = await this.processReferral(
          newUser.id,
          referralCode,
          deviceId,
          ipAddress,
        );
        referralReward = referralResult.reward;
      } catch (error: any) {
        console.error("[AuthService] 处理邀请码失败:", error.message);
      }
    } else {
    }

    return {
      user: newUser,
      isNewUser: true,
      token: this.generateToken(newUser.id),
      referralReward,
    };
  }

  /**
   * 处理邀请关系并发放奖励
   * 调用 ReferralService 的 useReferralCode 方法，确保逻辑一致性
   * 支持设备ID和IP地址记录
   */
  private async processReferral(
    inviteeId: string,
    referralCode: string,
    deviceId?: string,
    ipAddress?: string,
  ): Promise<{ inviterId: string; reward: number }> {
    try {
      const result = await this.referralService.useReferralCode(
        inviteeId, referralCode, deviceId, ipAddress
      );
      return { 
        inviterId: result.inviterId, 
        reward: result.reward || 0 
      };
    } catch (error: any) {
      console.error('[AuthService] 处理邀请码失败:', error.message);
      throw new Error(error.message);
    }
  }

  /**
   * 微信手机号授权登录
   * 通过微信 getPhoneNumber 获取手机号，根据手机号查找或创建用户
   * 支持设备ID和IP地址记录
   */
  async wechatPhoneLogin(
    code: string,
    phoneCode: string,
    nickname?: string,
    avatar?: string,
    referralCode?: string,
    deviceId?: string,
    ipAddress?: string,
  ): Promise<{
    user: any;
    isNewUser: boolean;
    token: string;
    referralReward?: number;
  }> {
    const wxAppId = process.env.WX_APP_ID;
    const wxAppSecret = process.env.WX_APP_SECRET;
    if (!wxAppId || !wxAppSecret) {
      throw new Error("微信配置未设置");
    }

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppId}&secret=${wxAppSecret}&js_code=${code}&grant_type=authorization_code`;
    try {
      const wxResponse = await fetch(wxUrl);
      const wxData = await wxResponse.json();
      if (wxData.errcode) {
        throw new Error(`微信登录失败: ${wxData.errmsg}`);
      }

      const openid = wxData.openid;
      let accessToken = await this.getWechatAccessToken();
      let phoneResult = await this.getWechatPhoneNumber(accessToken, phoneCode);
      
      // 如果 access_token 无效 (errcode 40001)，强制刷新后重试一次
      if (!phoneResult.phone && phoneResult.errcode === 40001) {
        accessToken = await this.getWechatAccessToken(true);
        phoneResult = await this.getWechatPhoneNumber(accessToken, phoneCode);
      }
      
      if (!phoneResult.phone) {
        throw new Error("获取手机号失败");
      }
      const phone = phoneResult.phone;

      const db = getMySQLClient();
      
      // 1. 先用 openid 查找用户（优先使用 openid）
      const openidResult = await db.query("users", { openid });
      const userByOpenid = Array.isArray(openidResult)
        ? openidResult[0]
        : (openidResult as any)?.data?.[0];
      
      if (userByOpenid) {
        // 找到用户，检查手机号是否需要更新
        const updateData: Record<string, any> = {};
        if (phone && !userByOpenid.phone) {
          updateData.phone = phone;
        }
        if (nickname && !userByOpenid.nickname) {
          updateData.nickname = nickname;
        }
        if (avatar && !userByOpenid.avatar) {
          updateData.avatar = avatar;
        }
        if (ipAddress) {
          updateData.last_login_ip = ipAddress;
        }
        if (Object.keys(updateData).length > 0) {
          await db.update("users", userByOpenid.id, updateData);
          const updatedResult = await db.query("users", { id: userByOpenid.id });
          const updatedUser = Array.isArray(updatedResult)
            ? updatedResult[0]
            : (updatedResult as any)?.data?.[0];
          return {
            user: updatedUser || userByOpenid,
            isNewUser: false,
            token: this.generateToken(userByOpenid.id),
          };
        }
        // 即使没有其他更新，也要更新登录IP
        if (ipAddress) {
          try {
            await db.updateWhere('users', { id: userByOpenid.id }, {
              last_login_ip: ipAddress,
              updated_at: new Date()
            })
          } catch (err) {
            console.error('[AuthService] 更新登录IP失败:', err)
          }
        }
        return {
          user: userByOpenid,
          isNewUser: false,
          token: this.generateToken(userByOpenid.id),
        };
      }
      
      // 2. openid 不存在，再用手机号查找（兼容老数据）
      const userByPhoneResult = await db.query("users", { phone });
      const userByPhone = Array.isArray(userByPhoneResult)
        ? userByPhoneResult[0]
        : (userByPhoneResult as any)?.data?.[0];
      
      if (userByPhone) {
        // 找到用户，检查 openid 是否需要更新
        const updateData: Record<string, any> = {};
        // 只有当 openid 为空或临时值时才更新，避免覆盖其他微信号的 openid
        if (!userByPhone.openid || userByPhone.openid.startsWith("phone_") || 
          userByPhone.openid.startsWith("auto_")|| 
          userByPhone.openid.startsWith("orphan_")) {
          updateData.openid = openid;
        }
        if (nickname && !userByPhone.nickname) {
          updateData.nickname = nickname;
        }
        if (avatar && !userByPhone.avatar) {
          updateData.avatar = avatar;
        }
        if (ipAddress) {
          updateData.last_login_ip = ipAddress;
        }
        if (Object.keys(updateData).length > 0) {
          await db.update("users", userByPhone.id, updateData);
          const updatedResult = await db.query("users", { id: userByPhone.id });
          const updatedUser = Array.isArray(updatedResult)
            ? updatedResult[0]
            : (updatedResult as any)?.data?.[0];
          return {
            user: updatedUser || userByPhone,
            isNewUser: false,
            token: this.generateToken(userByPhone.id),
          };
        }
        // 即使没有其他更新，也要更新登录IP
        if (ipAddress) {
          try {
            await db.updateWhere('users', { id: userByPhone.id }, {
              last_login_ip: ipAddress,
              updated_at: new Date()
            })
          } catch (err) {
            console.error('[AuthService] 更新登录IP失败:', err)
          }
        }
        return {
          user: userByPhone,
          isNewUser: false,
          token: this.generateToken(userByPhone.id),
        };
      }

      const userId = require("uuid").v4();
      const newUserData = {
        id: userId,
        openid,
        phone,
        nickname: nickname || `用户${phone.slice(-4)}`,
        avatar: avatar || "",
        level: 1,
        exp: 0,
        credits: 100,
        referral_code: this.generateReferralCode(),
        device_id: deviceId || null,
        ip_address: ipAddress || null,
        last_login_ip: ipAddress || null,
        created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
        updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      };
      const insertResult = await db.insert("users", newUserData);
      if (insertResult.error) {
        throw new Error(`创建用户失败: ${insertResult.error.message}`);
      }

      const newUserResult = await db.query("users", { phone });
      const newUser = Array.isArray(newUserResult)
        ? newUserResult[0]
        : (newUserResult as any)?.data?.[0];
      if (!newUser) {
        throw new Error("创建用户失败：未返回用户数据");
      }

      let referralReward = 0;
      if (referralCode && newUser) {
        try {
          const referralResult = await this.processReferral(
            newUser.id,
            referralCode,
            deviceId,
            ipAddress,
          );
          referralReward = referralResult.reward;
        } catch (error: any) {
          console.error(
            "[AuthService] 微信手机号登录-处理邀请码失败:",
            error.message,
          );
        }
      }

      return {
        user: newUser,
        isNewUser: true,
        token: this.generateToken(newUser.id),
        referralReward,
      };
    } catch (error: any) {
      throw new Error(`微信手机号登录失败: ${error.message}`);
    }
  }

  /**
   * 获取微信 access_token（用于调用 getPhoneNumber 接口）
   */
  private async getWechatAccessToken(forceRefresh: boolean = false): Promise<string> {
    const wxAppId = process.env.WX_APP_ID;
    const wxAppSecret = process.env.WX_APP_SECRET;
    const now = Date.now();
    const cached = this.accessTokenCache;
    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.token;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wxAppId}&secret=${wxAppSecret}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.errcode) {
      throw new Error(`获取access_token失败: ${data.errmsg}`);
    }

    this.accessTokenCache = {
      token: data.access_token,
      expiresAt: now + (data.expires_in - 300) * 1000,
    };
    return data.access_token;
  }

  /**
   * 通过微信 getPhoneNumber 接口获取用户手机号
   */
  private async getWechatPhoneNumber(
    accessToken: string,
    phoneCode: string,
  ): Promise<{ phone: string | null; errcode: number }> {
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: phoneCode }),
    });
    const data = await res.json();
    if (data.errcode !== 0) {
      console.error("[getWechatPhoneNumber] 获取手机号失败:", data);
      return { phone: null, errcode: data.errcode };
    }

    return {
      phone: data.phone_info?.phoneNumber || data.phone_info?.purePhoneNumber || null,
      errcode: 0
    };
  }

  /**
   * 微信静默登录（只查找用户，不创建新用户）
   * 用于已注册用户的自动登录，新用户需要手动授权登录
   */
  async wechatLogin(
    code: string,
  ): Promise<{ user: any; token: string; isNewUser: boolean }> {
    const wxAppId = process.env.WX_APP_ID;
    const wxAppSecret = process.env.WX_APP_SECRET;
    if (!wxAppId || !wxAppSecret) {
      throw new Error("微信配置未设置");
    }

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppId}&secret=${wxAppSecret}&js_code=${code}&grant_type=authorization_code`;
    try {
      const wxResponse = await fetch(wxUrl);
      const wxData = await wxResponse.json();
      if (wxData.errcode) {
        throw new Error(`微信登录失败: ${wxData.errmsg}`);
      }

      const openid = wxData.openid;
      const db = getMySQLClient();
      const result = await db.query("users", { openid });
      const existingUser = Array.isArray(result)
        ? result[0]
        : (result as any)?.data?.[0];
      
      if (existingUser) {
        return {
          user: existingUser,
          token: this.generateToken(existingUser.id),
          isNewUser: false,
        };
      }
      
      // 用户不存在，不自动创建，需要手动授权登录
      throw new Error("用户不存在，请使用手机号登录或微信授权登录");
    } catch (error: any) {
      throw new Error(`微信登录失败: ${error.message}`);
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(authHeader: string) {
    const token = this.extractAuthorizationToken(authHeader);
    if (!token) {
      throw new UnauthorizedException("请先登录");
    }

    const userId = this.verifyToken(token);
    if (!userId) {
      throw new UnauthorizedException("登录已过期");
    }

    const db = getMySQLClient();
    const result = await db.query("users", { id: userId });
    const user = Array.isArray(result) ? result[0] : (result as any)?.data?.[0];
    if (!user) {
      throw new UnauthorizedException("用户不存在");
    }

    return { user };
  }

  private extractAuthorizationToken(authHeader?: string): string | null {
    if (!authHeader) {
      return null;
    }

    const normalized = authHeader.trim();
    if (!normalized) {
      return null;
    }

    const matched = normalized.match(/^Bearer\s+(.+)$/i);
    if (matched) {
      return matched[1].trim();
    }

    return normalized;
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(userId: string) {
    const db = getMySQLClient();
    const result = await db.query("users", { id: userId });
    return Array.isArray(result) ? result[0] : (result as any)?.data?.[0];
  }

  /**
   * 生成 JWT token（简化版）
   */
  private generateToken(userId: string): string {
    const payload = { userId, iat: Date.now() };
    const secret = process.env.JWT_SECRET || "morena-secret-key";
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(encoded)
      .digest("hex");
    return `${encoded}.${signature}`;
  }

  /**
   * 验证 token
   */
  private verifyToken(token: string): string | null {
    try {
      const [encoded, signature] = token.split(".");
      const secret = process.env.JWT_SECRET || "morena-secret-key";
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("hex");
      if (signature !== expectedSignature) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(encoded, "base64").toString());
      if (Date.now() - payload.iat > 7 * 24 * 60 * 60 * 1000) {
        return null;
      }

      return payload.userId;
    } catch {
      return null;
    }
  }

  /**
   * 生成邀请码
   */
  private generateReferralCode(): string {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
  }
}
