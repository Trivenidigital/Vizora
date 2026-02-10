// Provide HTMLElement and customElements in Node test environment
class MockHTMLElement {
  connectedCallback() {}
  disconnectedCallback() {}
  attributeChangedCallback() {}
}

(global as any).HTMLElement = MockHTMLElement;
(global as any).customElements = {
  define: jest.fn(),
  get: jest.fn(),
};

describe('AppElement', () => {
  let AppElement: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // isolateModules ensures a fresh import each time
    jest.isolateModules(() => {
      // Mock CSS import
      jest.mock('./app.element.css', () => ({}), { virtual: true });
      ({ AppElement } = require('./app.element'));
    });
  });

  it('should be a class that extends HTMLElement', () => {
    expect(AppElement).toBeDefined();
    expect(AppElement.prototype).toBeInstanceOf(MockHTMLElement);
  });

  it('should have an empty observedAttributes array', () => {
    expect(AppElement.observedAttributes).toEqual([]);
  });

  it('should register as vizora-root custom element', () => {
    expect((global as any).customElements.define).toHaveBeenCalledWith(
      'vizora-root',
      AppElement,
    );
  });

  it('should have a connectedCallback method', () => {
    expect(typeof AppElement.prototype.connectedCallback).toBe('function');
  });

  it('connectedCallback should not throw', () => {
    const instance = new AppElement();
    expect(() => instance.connectedCallback()).not.toThrow();
  });
});
