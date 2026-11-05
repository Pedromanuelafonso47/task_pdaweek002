import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  activityCreateSchema,
  harvestCreateSchema,
  plantingCreateSchema,
  plantingUpdateSchema,
  type ActivityCreateInput,
  type HarvestCreateInput,
  type PlantingCreateInput,
} from '@agrogenius/shared';
import { CurrentUser, type AuthUser } from '../../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { ProductionService } from './production.service';

@ApiTags('production')
@ApiBearerAuth()
@Controller()
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('crops')
  crops() {
    return this.production.crops();
  }

  @Get('farms/:farmId/plantings')
  plantings(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.production.plantings(user, farmId);
  }

  @Post('farms/:farmId/plantings')
  @ApiZodBody(plantingCreateSchema)
  createPlanting(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string, @Body(new ZodPipe(plantingCreateSchema)) body: PlantingCreateInput) {
    return this.production.createPlanting(user, farmId, body);
  }

  @Patch('plantings/:id')
  @ApiZodBody(plantingUpdateSchema)
  updatePlanting(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(plantingUpdateSchema)) body: Partial<PlantingCreateInput>) {
    return this.production.updatePlanting(user, id, body);
  }

  @Delete('plantings/:id')
  removePlanting(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.removePlanting(user, id);
  }

  @Post('plantings/:id/activities')
  @ApiZodBody(activityCreateSchema)
  addActivity(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(activityCreateSchema)) body: ActivityCreateInput) {
    return this.production.addActivity(user, id, body);
  }

  @Post('plantings/:id/harvests')
  @ApiZodBody(harvestCreateSchema)
  addHarvest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(harvestCreateSchema)) body: HarvestCreateInput) {
    return this.production.addHarvest(user, id, body);
  }

  @Get('production/productivity')
  productivity(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.production.productivity(user, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get('production/calendar')
  calendar(@CurrentUser() user: AuthUser) {
    return this.production.calendar(user);
  }
}
