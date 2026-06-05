import { Controller, Get, Inject, Res } from '@nestjs/common';
import { AppService } from '@/app.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

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
}
