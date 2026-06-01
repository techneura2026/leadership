import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export function getTypeOrmConfig(configService: ConfigService): DataSourceOptions {
  return {
    type: 'postgres',
    url: configService.getOrThrow<string>('DATABASE_URL'),
    entities: [path.join(__dirname, '../../**/*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '../../migrations/*{.ts,.js}')],
    synchronize: false,
    logging: configService.get('NODE_ENV') === 'development' ? ['query', 'error'] : ['error'],
    ssl:
      configService.get('NODE_ENV') === 'production'
        ? { rejectUnauthorized: true }
        : false,
    extra: {
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    },
  };
}

// Standalone DataSource for TypeORM CLI (migration:generate, migration:run)
export const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://leaderprism:leaderprism_dev@localhost:5432/leaderprism',
  entities: [path.join(__dirname, '../../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../../migrations/*{.ts,.js}')],
  synchronize: false,
});
