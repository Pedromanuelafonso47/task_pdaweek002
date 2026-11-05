import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({ imports: [RecommendationsModule], controllers: [OnboardingController], providers: [OnboardingService] })
export class OnboardingModule {}
