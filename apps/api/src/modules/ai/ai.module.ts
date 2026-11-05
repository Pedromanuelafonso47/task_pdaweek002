import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({ imports: [RecommendationsModule], controllers: [AiController], providers: [AiService] })
export class AiModule {}
