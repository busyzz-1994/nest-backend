import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ROLE_KEY = 'requireRole';
export const RequireRole = (...roles: string[]) =>
  SetMetadata(REQUIRE_ROLE_KEY, roles);
