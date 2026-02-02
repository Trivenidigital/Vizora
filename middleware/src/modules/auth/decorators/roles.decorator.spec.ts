import { Roles, ROLES_KEY } from './roles.decorator';

describe('Roles Decorator', () => {
  it('should export ROLES_KEY constant', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('should be a function', () => {
    expect(typeof Roles).toBe('function');
  });

  it('should set roles metadata with single role', () => {
    @Roles('admin')
    class TestClass {}

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual(['admin']);
  });

  it('should set roles metadata with multiple roles', () => {
    @Roles('admin', 'manager', 'viewer')
    class TestClass {}

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual(['admin', 'manager', 'viewer']);
  });

  it('should set empty array when no roles provided', () => {
    @Roles()
    class TestClass {}

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual([]);
  });

  it('should work on methods', () => {
    class TestClass {
      @Roles('admin')
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass.prototype.testMethod);
    expect(metadata).toEqual(['admin']);
  });

  it('should not affect other classes', () => {
    @Roles('admin')
    class AdminClass {}

    class NoRolesClass {}

    expect(Reflect.getMetadata(ROLES_KEY, AdminClass)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, NoRolesClass)).toBeUndefined();
  });

  it('should support different roles for different methods', () => {
    class TestClass {
      @Roles('admin')
      adminOnly() {}

      @Roles('admin', 'manager')
      adminOrManager() {}

      @Roles('viewer')
      viewerOnly() {}
    }

    expect(Reflect.getMetadata(ROLES_KEY, TestClass.prototype.adminOnly)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, TestClass.prototype.adminOrManager)).toEqual([
      'admin',
      'manager',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, TestClass.prototype.viewerOnly)).toEqual(['viewer']);
  });
});
