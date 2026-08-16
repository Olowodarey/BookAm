import { Module } from '@nestjs/common';
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
        // Schema is managed by TypeORM migrations (see src/database).
        synchronize: false,
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
