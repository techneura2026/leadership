import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AccessTokenPayload } from '@leaderprism/shared';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload & { mustChangePassword: boolean }> {
    if (!payload.sub || !payload.orgId) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findByIdInternal(payload.sub);
    if (!user || user.organisationId !== payload.orgId || !user.isActive) {
      throw new UnauthorizedException();
    }
    // Piggybacks on the lookup above (already needed to re-check isActive on every request)
    // rather than issuing a second query — see MustChangePasswordGuard for how this is used.
    return { ...payload, mustChangePassword: user.mustChangePassword };
  }
}
