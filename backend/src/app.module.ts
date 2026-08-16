import { Module } from '@nestjs/common';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UuidSubscriber } from './database/uuid.subscriber';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CirclesModule } from './circles/circles.module';
import { MemberModule } from './member/member.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        subscribers: [UuidSubscriber],
        // Schema is managed by migrations, never auto-sync. Migrations run on
        // boot (migrationsRun) so a deploy applies pending schema changes within
        // the app's own connection — no separate/fragile preDeploy step needed.
        synchronize: false,
        migrationsRun: true,
        migrations: [join(__dirname, 'database', 'migrations', '*.{js,ts}')],
      }),
    }),
    AuthModule,
    AdminModule,
    CirclesModule,
    MemberModule,
    WaitlistModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
