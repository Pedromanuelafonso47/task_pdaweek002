import { Global, Module } from '@nestjs/common';
import { FarmAccessService } from './farm-access.service';

@Global()
@Module({ providers: [FarmAccessService], exports: [FarmAccessService] })
export class AccessModule {}
