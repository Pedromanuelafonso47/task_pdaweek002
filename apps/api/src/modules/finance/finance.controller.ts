import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { transactionCreateSchema, transactionUpdateSchema, type TransactionCreateInput } from '@agrogenius/shared';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { FinanceService, type TxFilter } from './finance.service';

function parseFilter(q: Record<string, string | undefined>): TxFilter {
  return {
    farmId: q.farmId || undefined,
    type: q.type === 'INCOME' || q.type === 'EXPENSE' ? q.type : undefined,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  };
}

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('transactions')
  @ApiQuery({ name: 'farmId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['INCOME', 'EXPENSE'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  list(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    return this.finance.list(user, parseFilter(q));
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    return this.finance.summary(user, parseFilter(q));
  }

  @Roles('FARMER', 'ADMIN')
  @Post('transactions')
  @ApiZodBody(transactionCreateSchema)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(transactionCreateSchema)) body: TransactionCreateInput) {
    return this.finance.create(user, body);
  }

  @Roles('FARMER', 'ADMIN')
  @Patch('transactions/:id')
  @ApiZodBody(transactionUpdateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(transactionUpdateSchema)) body: Partial<TransactionCreateInput>) {
    return this.finance.update(user, id, body);
  }

  @Roles('FARMER', 'ADMIN')
  @Delete('transactions/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.finance.remove(user, id);
  }
}
