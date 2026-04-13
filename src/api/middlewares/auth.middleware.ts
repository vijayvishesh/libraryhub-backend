import { Action, UnauthorizedError } from 'routing-controllers';
import { Container } from 'typedi';
import { CurrentSessionData } from '../controllers/responses/auth.response';
import { AuthService } from '../services/auth.service';

const SESSION_KEY = '_currentSession';

export async function authorizationChecker(action: Action, roles: string[]): Promise<boolean> {
  const authService = Container.get(AuthService);
  const authorizationHeader = action.request.header('authorization');

  const session: CurrentSessionData = await authService.getCurrentSession(authorizationHeader);
  action.request[SESSION_KEY] = session;

  if (roles.length > 0 && !roles.includes(session.user.role)) {
    throw new UnauthorizedError('INSUFFICIENT_ROLE');
  }

  return true;
}

export function currentUserChecker(action: Action): CurrentSessionData | undefined {
  return action.request[SESSION_KEY];
}
