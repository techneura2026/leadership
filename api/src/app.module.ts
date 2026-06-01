import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './core/auth/auth.module';
import { OrganisationsModule } from './core/organisations/organisations.module';
import { UsersModule } from './core/users/users.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { ItemsModule } from './assessment/items/items.module';
import { EngineModule } from './assessment/engine/engine.module';
import { Uc1FeedbackModule } from './assessment/uc1-feedback/uc1-feedback.module';
import { Uc2CompetencyModule } from './assessment/uc2-competency/uc2-competency.module';
import { Uc3PersonalityModule } from './assessment/uc3-personality/uc3-personality.module';
import { Uc4ReadinessModule } from './assessment/uc4-readiness/uc4-readiness.module';
import { ReportingModule } from './reporting/reporting.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        // In test mode, raise the limit so auth/validation E2E tests are not rate-limited.
        // Rate-limit behaviour is tested separately in 12-rate-limiting.e2e-spec.ts.
        limit: process.env.NODE_ENV === 'test' ? 9999 : 100,
      },
    ]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    DatabaseModule,
    AuthModule,
    OrganisationsModule,
    UsersModule,
    NotificationsModule,
    ItemsModule,
    EngineModule,
    Uc1FeedbackModule,
    Uc2CompetencyModule,
    Uc3PersonalityModule,
    Uc4ReadinessModule,
    ReportingModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
