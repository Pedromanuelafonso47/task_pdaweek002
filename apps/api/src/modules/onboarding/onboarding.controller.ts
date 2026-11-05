import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { onboardingSchema, type OnboardingInput } from '@agrogenius/shared';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@ApiBearerAuth()
@Roles('FARMER')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  draft(@CurrentUser() user: AuthUser) {
    return this.onboarding.getDraft(user);
  }

  @Put('draft')
  saveDraft(@CurrentUser() user: AuthUser, @Body() body: { draft: unknown }) {
    return this.onboarding.saveDraft(user, body?.draft ?? null);
  }

  @Post('complete')
  @ApiZodBody(onboardingSchema)
  complete(@CurrentUser() user: AuthUser, @Body(new ZodPipe(onboardingSchema)) body: OnboardingInput) {
    return this.onboarding.complete(user, body);
  }
}
