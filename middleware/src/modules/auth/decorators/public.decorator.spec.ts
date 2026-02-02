import { Public, IS_PUBLIC_KEY } from './public.decorator';
import { SetMetadata } from '@nestjs/common';

describe('Public Decorator', () => {
  it('should export IS_PUBLIC_KEY constant', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('should be a function', () => {
    expect(typeof Public).toBe('function');
  });

  it('should set isPublic metadata to true', () => {
    @Public()
    class TestClass {}

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestClass);
    expect(metadata).toBe(true);
  });

  it('should work on methods', () => {
    class TestClass {
      @Public()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestClass.prototype.testMethod);
    expect(metadata).toBe(true);
  });

  it('should not affect other classes', () => {
    @Public()
    class PublicClass {}

    class PrivateClass {}

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicClass)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PrivateClass)).toBeUndefined();
  });
});
