import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getData', () => {
    it('should return message object', () => {
      const result = service.getData();

      expect(result).toEqual({ message: 'Hello API' });
    });

    it('should return object with message property', () => {
      const result = service.getData();

      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
    });

    it('should return consistent result on multiple calls', () => {
      const result1 = service.getData();
      const result2 = service.getData();

      expect(result1).toEqual(result2);
    });
  });
});
