import { Injectable, ExecutionContext, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from '../../api-keys/guards/api-key.guard';
import { ALLOW_API_KEY } from '../decorators/allow-api-key.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  /**
   * ApiKeyGuard is @Optional deliberately.
   *
   * This guard is the GLOBAL APP_GUARD, so a required dependency would force
   * every TestingModule that touches any authenticated controller to provide
   * the api-keys graph — three controller specs broke on exactly that. More
   * importantly it fails in the safe direction: if the guard is ever absent,
   * an @AllowApiKey route falls back to JWT-only rather than erroring, so a DI
   * regression cannot open a route. It is logged rather than swallowed, so the
   * capability cannot go missing silently either.
   */
  constructor(
    private reflector: Reflector,
    @Optional() private readonly apiKeyGuard?: ApiKeyGuard,
  ) {
    super();
  }

  /**
   * Deliberately NOT `async`.
   *
   * Marking it async wraps every synchronous throw in a rejected promise, and
   * this guard's existing spec asserts that a failure inside getHandler/getClass
   * propagates synchronously. Those assertions are describing real behaviour of
   * the global guard, so the api-key branch returns a promise on its own path
   * instead of changing the contract for every other request.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    /**
     * API-key authentication is an OPT-IN extension of this guard, not a
     * replacement for it, and not `@Public()` plus a route-level composite.
     * `@Public()` would disable this guard outright, so a later refactor that
     * dropped the composite would leave the route open. Here, removing
     * `@AllowApiKey()` reverts the route to JWT-only — it fails closed.
     *
     * Precedence is deterministic and key-first: if the route opts in AND the
     * request carries `x-api-key`, that key decides the request. An invalid key
     * is a 401 rather than a silent fall-through to whatever session cookie
     * happens to be attached — otherwise a broken integration would appear to
     * work as whichever human was signed in, which is both confusing and a
     * privilege surprise.
     */
    const allowsApiKey = this.reflector.getAllAndOverride<boolean>(ALLOW_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowsApiKey) {
      const request = context.switchToHttp().getRequest();
      const presented = request?.headers?.['x-api-key'];
      // A duplicated header arrives as an array; only a non-empty string is a
      // credential attempt.
      const hasKey = typeof presented === 'string' && presented.length > 0;

      if (hasKey && !this.apiKeyGuard) {
        this.logger.error(
          'Route allows API keys but ApiKeyGuard is not available — falling back to JWT. API-key auth is DISABLED for this request.',
        );
      }

      if (hasKey && this.apiKeyGuard) {
        return Promise.resolve(this.apiKeyGuard.canActivate(context)).then((accepted) => {
          if (!accepted) {
            throw new UnauthorizedException('Invalid API key');
          }
          return true;
        });
      }
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }
}
