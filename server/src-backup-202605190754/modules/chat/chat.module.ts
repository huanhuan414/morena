import { Module, forwardRef } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AgentModule } from '../agent/agent.module';
import { AvatarModule } from '../avatar/avatar.module';

@Module({
  imports: [forwardRef(() => AgentModule), forwardRef(() => AvatarModule)],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService]
})
export class ChatModule {}
