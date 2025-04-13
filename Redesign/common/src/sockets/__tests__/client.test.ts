/**
 * Stub test file for socket client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VizoraSocketClient, defaultClient } from '../client';

describe('VizoraSocketClient', () => {
  let client: VizoraSocketClient;
  
  beforeEach(() => {
    client = new VizoraSocketClient();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  it('should create a socket client instance', () => {
    expect(client).toBeInstanceOf(VizoraSocketClient);
  });
  
  it('should return a promise from connect()', async () => {
    const result = client.connect();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });
  
  it('should export a default client instance', () => {
    expect(defaultClient).toBeInstanceOf(VizoraSocketClient);
  });
}); 