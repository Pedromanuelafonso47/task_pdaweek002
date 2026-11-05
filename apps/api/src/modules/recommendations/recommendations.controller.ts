import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { recommendationStatusSchema } from '@agrogenius/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { RecommendationsService } from './recommendations.service';

const manualSchema = z.object({
  projectSlug: z.string().min(1),
  problem: z.string().trim().min(3).max(200),
  justification: z.string().trim().min(10).max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});

const farmProjectSchema = z.object({
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  actualCostKz: z.number().min(0).nullable(),
  notes: z.string().max(2000).nullable(),
}).partial();

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller()
export class RecommendationsController {
  constructor(private readonly recs: RecommendationsService) {}

  @Get('farms/:farmId/recommendations')
  list(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.recs.list(user, farmId);
  }

  @Post('farms/:farmId/recommendations/generate')
  generate(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.recs.generate(user, farmId);
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post('farms/:farmId/recommendations/manual')
  @ApiZodBody(manualSchema)
  manual(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string, @Body(new ZodPipe(manualSchema)) body: z.infer<typeof manualSchema>) {
    return this.recs.createManual(user, farmId, body);
  }

  @Get('recommendations/pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.recs.pending(user);
  }

  @Get('recommendations/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.recs.get(user, id);
  }

  @Patch('recommendations/:id/status')
  @ApiZodBody(recommendationStatusSchema)
  status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(recommendationStatusSchema)) body: z.infer<typeof recommendationStatusSchema>) {
    return this.recs.setStatus(user, id, body.status);
  }

  @Get('farms/:farmId/projects')
  farmProjects(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.recs.farmProjects(user, farmId);
  }

  @Roles('FARMER', 'ADMIN')
  @Patch('farm-projects/:id')
  @ApiZodBody(farmProjectSchema)
  updateFarmProject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(farmProjectSchema)) body: z.infer<typeof farmProjectSchema>) {
    return this.recs.updateFarmProject(user, id, body);
  }

  @Roles('TECHNICIAN', 'ADMIN')
  @Post('recommendations/:id/validate')
  validate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.recs.validate(user, id);
  }
}
