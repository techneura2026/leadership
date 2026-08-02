import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/shared/filters/http-exception.filter';
import { TransformInterceptor } from '../../../src/shared/interceptors/transform.interceptor';

let _app: INestApplication | null = null;

// Jest isolates each spec file's module registry, so every *.e2e-spec.ts that imports this
// helper gets its own fresh `_app` the first time getApp() runs — including its own instance
// of every long-lived provider the full AppModule registers, notably the BullMQ ReportProcessor
// worker. Nothing ever called app.close() here, so those apps (and their workers, still
// listening on the shared 'reports' Redis queue) leaked past that spec file's own Jest teardown.
// Once report generation became genuinely async, a job enqueued by one spec file could get
// picked up by a *different*, already-finished spec file's zombie worker, whose Jest module
// registry had already been torn down — surfacing as an intermittent "Cannot read properties of
// undefined (reading 'launch')" from pdf.service.ts's dynamic `import('puppeteer')` resolving
// against a dead registry. Registering this at module scope (not inside getApp() itself) means
// it runs once per spec file, at collection time, exactly when Jest requires afterAll() to be
// called — closing whichever app that specific file ends up creating.
afterAll(async () => {
  if (_app) {
    await _app.close();
    _app = null;
  }
});

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
