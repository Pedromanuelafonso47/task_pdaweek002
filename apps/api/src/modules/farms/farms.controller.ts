import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  farmCreateSchema,
  farmUpdateSchema,
  fieldCreateSchema,
  fieldUpdateSchema,
  type FarmCreateInput,
  type FarmUpdateInput,
  type FieldCreateInput,
} from '@agrogenius/shared';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { FarmsService } from './farms.service';

@ApiTags('farms')
@ApiBearerAuth()
@Controller('farms')
export class FarmsController {
  constructor(private readonly farms: FarmsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.farms.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.farms.get(user, id);
  }

  @Roles('FARMER', 'ADMIN')
  @Post()
  @ApiZodBody(farmCreateSchema)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(farmCreateSchema)) body: FarmCreateInput) {
    return this.farms.create(user, body);
  }

  @Patch(':id')
  @ApiZodBody(farmUpdateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(farmUpdateSchema)) body: FarmUpdateInput) {
    return this.farms.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.farms.remove(user, id);
  }

  @Get(':id/fields')
  fields(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.farms.listFields(user, id);
  }

  @Post(':id/fields')
  @ApiZodBody(fieldCreateSchema)
  createField(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(fieldCreateSchema)) body: FieldCreateInput) {
    return this.farms.createField(user, id, body);
  }

  @Patch(':id/fields/:fieldId')
  @ApiZodBody(fieldUpdateSchema)
  updateField(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @Body(new ZodPipe(fieldUpdateSchema)) body: Partial<FieldCreateInput>,
  ) {
    return this.farms.updateField(user, id, fieldId, body);
  }

  @Delete(':id/fields/:fieldId')
  removeField(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('fieldId') fieldId: string) {
    return this.farms.removeField(user, id, fieldId);
  }
}
