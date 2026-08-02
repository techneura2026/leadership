import { SetMetadata } from '@nestjs/common';

export const SKIP_PASSWORD_CHECK_KEY = 'skipPasswordCheck';

/** Marks a route as reachable even when the caller's account has mustChangePassword set — used only by the handful of auth endpoints needed to actually perform that change. */
export const SkipPasswordCheck = () => SetMetadata(SKIP_PASSWORD_CHECK_KEY, true);
