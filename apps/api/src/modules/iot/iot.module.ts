import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { IotController } from './iot.controller';
import { IotService } from './iot.service';
import { MqttService } from './mqtt.service';

@Module({
  controllers: [IotController],
  providers: [MqttService, AutomationService, IotService],
  exports: [IotService],
})
export class IotModule {}
