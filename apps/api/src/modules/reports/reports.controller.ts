import { BadRequestException, Controller, Get, Module, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../../common/auth.decorators';
import { FinanceModule } from '../finance/finance.module';
import { ProductionModule } from '../production/production.module';
import { REPORT_TYPES, ReportsService, type ReportType } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':type')
  @ApiProduces('application/pdf')
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param('type') type: string,
    @Query('farmId') farmId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    if (!REPORT_TYPES.includes(type as ReportType)) throw new BadRequestException(`Tipos válidos: ${REPORT_TYPES.join(', ')}`);
    if (!farmId) throw new BadRequestException('Indica a propriedade (farmId)');
    const t = to ? new Date(to) : new Date();
    const f = from ? new Date(from) : new Date(t.getFullYear(), 0, 1);
    const { buffer, filename } = await this.reports.build(user, type as ReportType, farmId, f, t);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}

@Module({ imports: [FinanceModule, ProductionModule], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
