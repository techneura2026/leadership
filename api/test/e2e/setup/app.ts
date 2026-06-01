import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/shared/filters/http-exception.filter';
import { TransformInterceptor } from '../../../src/shared/interceptors/transform.interceptor';

let _app: INestApplication | null = null;

/**
 * Returns (and caches) a single NestJS test application for the entire e2e suite.
 * The first call bootstraps the full AppModule against the test database.
 * Subsequent calls return the cached instance without re-bootstrapping.
 */
export async function getApp(): Promise<INestApplication> {
  if (_app) return _app;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  _app = moduleRef.createNestApplication();
  _app.use(cookieParser());
  _app.setGlobalPrefix('api/v1');
  _app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  _app.useGlobalFilters(new HttpExceptionFilter());
  _app.useGlobalInterceptors(new TransformInterceptor());

  await _app.init();
  return _app;
}

export function http(app: INestApplication) {
  return request(app.getHttpServer());
}
