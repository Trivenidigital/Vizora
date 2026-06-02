import { AppModule } from './app.module';
import { CsrfMiddleware } from '../modules/common/middleware/csrf.middleware';

describe('AppModule', () => {
  it('mounts CSRF middleware for runtime requests', () => {
    const forRoutes = jest.fn();
    const apply = jest.fn().mockReturnValue({ forRoutes });
    const module = new AppModule();

    module.configure({ apply } as any);

    expect(apply).toHaveBeenCalledWith(CsrfMiddleware);
    expect(forRoutes).toHaveBeenCalledWith('*');
  });
});
