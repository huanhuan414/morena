import { Controller, Get, Headers, Inject, Post, Res, UnauthorizedException } from '@nestjs/common';
import { AppService } from '@/app.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get('hello')
  getHello(): { status: string; data: string } {
    return {
      status: 'success',
      data: this.appService.getHello()
    };
  }

  @Get('health')
  getHealth(): { status: string; data: string } {
    return {
      status: 'success',
      data: new Date().toISOString(),
    };
  }

  @Get('prototype')
  servePrototype(@Res() res: Response) {
    const projectRoot = process.cwd().includes('server')
      ? path.join(process.cwd(), '..')
      : process.cwd();
    const filePath = path.join(projectRoot, 'prototype-full.html');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(filePath);
    } else {
      res.status(404).send('Prototype not found');
    }
  }

  /**
   * 部署Webhook：拉取最新代码并重启服务
   * 调用方式: POST /api/deploy -H "X-Deploy-Token: <token>"
   * Token 通过环境变量 DEPLOY_TOKEN 配置，未配置则默认为 morena-deploy-2024
   */
  @Post('deploy')
  deploy(@Headers('x-deploy-token') token: string) {
    const expectedToken = process.env.DEPLOY_TOKEN || 'morena-deploy-2024';
    if (token !== expectedToken) {
      throw new UnauthorizedException('Invalid deploy token');
    }

    const projectRoot = process.cwd().includes('server')
      ? path.join(process.cwd(), '..')
      : process.cwd();

    const logs: string[] = [];

    const run = (cmd: string, label: string) => {
      try {
        const output = execSync(cmd, {
          cwd: projectRoot,
          timeout: 120000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        logs.push(`[${label}] OK: ${output.trim().slice(0, 200)}`);
      } catch (err: any) {
        logs.push(`[${label}] ERROR: ${err.message?.slice(0, 200)}`);
      }
    };

    // 1. 拉取最新代码
    run('git fetch origin main && git reset --hard origin/main', 'git-pull');

    // 2. 安装依赖
    run('pnpm install --frozen-lockfile 2>/dev/null || pnpm install', 'pnpm-install');

    // 3. 构建服务端
    run('cd server && pnpm build', 'server-build');

    // 4. 重启 PM2
    run('pm2 restart morena-api || pm2 restart all', 'pm2-restart');

    return {
      status: 'success',
      message: 'Deploy triggered',
      logs,
    };
  }
}
