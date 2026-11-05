import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { AiService } from './ai.service';

const askSchema = z.object({
  message: z.string().trim().min(2).max(2000),
  farmId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
});

@ApiTags('ai — Agro AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return { mode: this.ai.mode };
  }

  @Get('conversations')
  list(@CurrentUser() user: AuthUser, @Query('farmId') farmId?: string) {
    return this.ai.conversations(user, farmId);
  }

  @Get('conversations/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ai.conversation(user, id);
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('ask')
  @ApiZodBody(askSchema)
  ask(@CurrentUser() user: AuthUser, @Body(new ZodPipe(askSchema)) body: z.infer<typeof askSchema>) {
    return this.ai.ask(user, body);
  }
}
