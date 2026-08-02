import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccessTokenPayload } from '@leaderprism/shared';
import { UsersService } from '../../users/users.service';
import { SKIP_PASSWORD_CHECK_KEY } from '../../../shared/decorators/skip-password-check.decorator';

/**
 * Blocks every authenticated route for a user whose account is flagged mustChangePassword —
 * closing the gap where an admin-created (or freshly reset) account could be used indefinitely
 * without ever setting a real password.
 *
 * Registered as a global APP_GUARD, which in this codebase's pattern (JwtAuthGuard/RolesGuard
 * applied per-controller via @UseGuards, not globally) runs BEFORE those controller-level
 * guards — so request.user is NOT yet populated when this guard executes. Rather than depend on
 * guard ordering, it verifies the bearer token itself (same secret/payload JwtStrategy uses) and
 * looks the user up directly. An invalid/missing token is not this guard's concern — it lets the
 * request through and leaves rejecting it to the route's own JwtAuthGuard.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PASSWORD_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) return true; // no token — not this guard's concern

    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify(authHeader.slice(7), {
        secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      });
    } catch {
      return true; // invalid/expired token — the route's own JwtAuthGuard will reject it
    }

    const user = await this.usersService.findByIdInternal(payload.sub);
    if (user?.mustChangePassword) {
      throw new ForbiddenException({
        message: 'You must change your password before continuing.',
        error: 'MUST_CHANGE_PASSWORD',
      });
    }

    return true;
  }
}
