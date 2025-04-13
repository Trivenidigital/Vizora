// A minimal test that doesn't depend on any external modules
describe('Minimal Tests', () => {
  test('basic math', () => {
    expect(1 + 1).toBe(2);
  });

  test('string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
  });
}); 