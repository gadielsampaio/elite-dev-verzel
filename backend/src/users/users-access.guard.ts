import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';

@Injectable()
export class UsersAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user, params, method } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    if (user.role === 'admin') return true;

    if ((method === 'GET' || method === 'PATCH') && params.id === user.id)
      return true;

    throw new ForbiddenException();
  }
}
