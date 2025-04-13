/**
 * A simple event emitter implementation for browser environments
 */
export class EventEmitter {
  private events: Record<string, Function[]> = {};

  /**
   * Adds a listener for the specified event
   */
  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  /**
   * Adds a one-time listener for the specified event
   */
  once(event: string, listener: Function): this {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
    return this;
  }

  /**
   * Removes a listener for the specified event
   */
  off(event: string, listener: Function): this {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
      if (this.events[event].length === 0) {
        delete this.events[event];
      }
    }
    return this;
  }

  /**
   * Removes all listeners for the specified event or all events
   */
  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  /**
   * Emits an event with the provided arguments
   */
  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) {
      return false;
    }
    
    this.events[event].forEach(listener => {
      listener(...args);
    });
    
    return true;
  }

  /**
   * Returns an array of listeners for the specified event
   */
  listeners(event: string): Function[] {
    return this.events[event] || [];
  }

  /**
   * Returns the number of listeners for the specified event
   */
  listenerCount(event: string): number {
    return this.listeners(event).length;
  }
} 