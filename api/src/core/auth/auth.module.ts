import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { OrganisationsModule } from '../organisations/organisations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SsoTicket } from './sso/sso-ticket.entity';
import { SsoTicketService } from './sso/sso-ticket.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SsoTicket]),
    PassportModule,
    JwtModule.register({}),
    UsersModule,
    OrganisationsModule,
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, SsoTicketService],
  exports: [AuthService, SsoTicketService],
})
export class AuthModule {}
