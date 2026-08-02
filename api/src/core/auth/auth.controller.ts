import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterOrgDto } from './dto/register-org.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { SkipPasswordCheck } from '../../shared/decorators/skip-password-check.decorator';
import { AccessTokenPayload } from '@leaderprism/shared';
import { User } from '../users/entities/user.entity';

const REFRESH_COOKIE = 'refresh_token';

// Route-level @Throttle() overrides bypass ThrottlerModule's own NODE_ENV-aware default
// limit (see app.module.ts), so they need the same test-mode scaling applied here —
// otherwise every e2e suite that registers/logs in more than a few times per minute
// starts getting legitimately (but unintentionally) rate-limited.
const isTestEnv = process.env.NODE_ENV === 'test';
const REGISTER_LIMIT = isTestEnv ? 9999 : 5;
const LOGIN_LIMIT = isTestEnv ? 9999 : 10;
const REFRESH_LIMIT = isTestEnv ? 9999 : 30;
const FORGOT_PASSWORD_LIMIT = isTestEnv ? 9999 : 5;
const RESET_PASSWORD_LIMIT = isTestEnv ? 9999 : 10;
const CHANGE_PASSWORD_LIMIT = isTestEnv ? 9999 : 10;

function setRefreshCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    path: '/',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: REGISTER_LIMIT, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new organisation and admin user' })
  async register(@Body() dto: RegisterOrgDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto, req as any);
    const { refreshToken, ...response } = result as any;
    setRefreshCookie(res, refreshToken);
    return response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  @UseGuards(AuthGuard('local'))
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Req() req: Request & { user: User }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(req.user, req as any);
    const { refreshToken, ...response } = result as any;
    setRefreshCookie(res, refreshToken);
    return response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: REFRESH_LIMIT, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refresh access token using the refresh cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      clearRefreshCookie(res);
      throw new UnauthorizedException('No refresh token');
    }

    try {
      const result = await this.authService.refresh(token, req as any);
      setRefreshCookie(res, result.refreshToken);
      return { accessToken: result.accessToken, user: result.user, organisation: result.organisation };
    } catch (err) {
      clearRefreshCookie(res);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @SkipPasswordCheck()
  @ApiOperation({ summary: 'Logout and invalidate the refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) {
      await this.authService.logout(token);
    }
    clearRefreshCookie(res);
    return { success: true };
  }

  @Post('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @SkipPasswordCheck()
  @ApiOperation({ summary: 'Get current authenticated user from token' })
  async me(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.getMe(user.sub);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: CHANGE_PASSWORD_LIMIT, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @SkipPasswordCheck()
  @ApiOperation({ summary: 'Change your own password (also clears the forced-change flag)' })
  async changePassword(@CurrentUser() user: AccessTokenPayload, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    return { success: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: FORGOT_PASSWORD_LIMIT, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Always the same response, whether or not the email matched an account.
    return { success: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: RESET_PASSWORD_LIMIT, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password using a token from the forgot-password email' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }
}
