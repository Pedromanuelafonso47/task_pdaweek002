import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({ origin: origin.split(','), credentials: true });
  app.enableShutdownHooks();
  // BigInt (ids de leituras) → string em JSON
  (BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
    return this.toString();
  };

  const config = new DocumentBuilder()
    .setTitle('AGROGENIUS API')
    .setDescription('Plataforma inteligente de gestão agrária, agricultura de precisão e automação IoT')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`API em http://localhost:${port}/api · Swagger em http://localhost:${port}/api/docs`, 'Bootstrap');
}
bootstrap();
