import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SchedulerService } from './scheduler.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, RealtimeGateway, SchedulerService],
  exports: [NotificationsService, RealtimeGateway],
})
export class NotificationsModule {}
