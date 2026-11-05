import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Difficulty, ProjectCategory } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../../common/auth.decorators';
import { ProjectsService } from './projects.service';

@ApiTags('agrotech-lab')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'difficulty', required: false })
  @ApiQuery({ name: 'maxCostKz', required: false })
  @ApiQuery({ name: 'offline', required: false })
  @ApiQuery({ name: 'favorites', required: false })
  list(@CurrentUser() user: AuthUser, @Query() q: Record<string, string | undefined>) {
    return this.projects.list(user.id, {
      q: q.q?.trim() || undefined,
      category: (q.category as ProjectCategory) || undefined,
      difficulty: (q.difficulty as Difficulty) || undefined,
      maxCostKz: q.maxCostKz ? Number(q.maxCostKz) : undefined,
      offline: q.offline === 'true',
      favorites: q.favorites === 'true',
    });
  }

  @Get('compare')
  @ApiQuery({ name: 'slugs', description: 'slugs separados por vírgula (máx. 4)' })
  compare(@CurrentUser() user: AuthUser, @Query('slugs') slugs = '') {
    return this.projects.compare(user.id, slugs.split(',').filter(Boolean));
  }

  @Get(':slug')
  get(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.projects.get(user.id, slug);
  }

  @Post(':slug/favorite')
  favorite(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.projects.toggleFavorite(user.id, slug);
  }
}
