/**
 * A simple socket client stub
 * Temporary placeholder to fix build issues - will be properly implemented in future versions
 */

// No direct imports to avoid dependency issues
export class VizoraSocketClient {
  constructor() {
    console.log('Socket client created');
  }
  
  connect() {
    console.log('Socket client connect() called');
    return Promise.resolve();
  }
  
  disconnect() {
    console.log('Socket client disconnect() called');
  }
  
  on() {
    console.log('Socket client on() called');
  }
  
  off() {
    console.log('Socket client off() called');
  }
  
  emit() {
    console.log('Socket client emit() called');
  }
}

// Export a default instance
export const defaultClient = new VizoraSocketClient(); 