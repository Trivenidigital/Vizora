import EventEmitter from 'eventemitter3';

export interface TokenMetadata {
  userId?: string;
  deviceId?: string;
  role?: string;
  expires?: number;
  isValid: boolean;
  issuedAt?: number;
}

export interface TokenOptions {
  storageKey?: string;
  refreshThresholdMs?: number;  // How long before expiry to refresh token
  autoRefresh?: boolean;        // Whether to auto-refresh tokens
  validateOnLoad?: boolean;     // Whether to validate token on load
  tokenPrefix?: string;         // Remove if token has prefix like 'Bearer '
  storage?: Storage;            // Storage mechanism, defaults to localStorage
}

export interface RefreshConfig {
  url: string;
  fetchFn?: typeof fetch;      // Allow custom fetch function
  method?: string;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
  customPayload?: Record<string, any>;
  responseProcessor?: (response: any) => string | null;
}

export type TokenEventType = 
  | 'token:loaded'
  | 'token:stored'
  | 'token:removed'
  | 'token:expired'
  | 'token:refresh:start'
  | 'token:refresh:success'
  | 'token:refresh:failed'
  | 'token:validate:success'
  | 'token:validate:failed';

/**
 * Token Manager for handling JWT or other authentication tokens
 * Provides utilities for token storage, validation, and refresh
 */
export class TokenManager extends EventEmitter {
  private token: string | null = null;
  private metadata: TokenMetadata | null = null;
  private refreshTimer: any = null;
  private refreshPromise: Promise<string | null> | null = null;
  private refreshing = false;
  private options: TokenOptions;
  private refreshConfig: RefreshConfig | null = null;
  private storage: Storage;
  private readonly serviceName: string;

  /**
   * Create a new TokenManager
   * @param options Token manager options
   * @param refreshConfig Token refresh configuration (optional)
   */
  constructor(
    options: TokenOptions = {},
    refreshConfig: RefreshConfig | null = null,
    serviceName = 'TokenManager'
  ) {
    super();
    this.options = {
      storageKey: 'auth_token',
      refreshThresholdMs: 5 * 60 * 1000, // 5 minutes
      autoRefresh: true,
      validateOnLoad: true,
      tokenPrefix: '',
      ...options
    };
    
    // Use provided storage or fall back to localStorage if available
    if (options.storage) {
      this.storage = options.storage;
    } else if (typeof localStorage !== 'undefined') {
      this.storage = localStorage;
    } else {
      // Memory-only storage fallback
      this.storage = {
        getItem: (key: string) => this.token,
        setItem: (key: string, value: string) => { this.token = value; },
        removeItem: (key: string) => { this.token = null; },
        clear: () => { this.token = null; },
        key: (index: number) => null,
        length: 0
      };
    }
    
    this.refreshConfig = refreshConfig;
    this.serviceName = serviceName;
    
    // Load token if we're in a browser context
    if (typeof window !== 'undefined') {
      this.loadToken();
      
      // Set up auto-refresh if enabled
      if (this.options.autoRefresh && refreshConfig) {
        this.setupAutoRefresh();
      }
    }
  }
  
  /**
   * Get the current token
   * @returns The current token or null if not available
   */
  public getToken(): string | null {
    return this.token;
  }
  
  /**
   * Set a new token
   * @param token The new token to set
   * @param persist Whether to persist the token to storage
   */
  public setToken(token: string | null, persist = true): void {
    // Remove token prefix if any
    if (token && this.options.tokenPrefix && token.startsWith(this.options.tokenPrefix)) {
      token = token.substring(this.options.tokenPrefix.length);
    }
    
    this.token = token;
    
    // Clear previous metadata
    this.metadata = null;
    
    // Persist to storage if requested
    if (persist && token) {
      this.storage.setItem(this.options.storageKey!, token);
      this.emit('token:stored', { token: this.getMaskedToken() });
    } else if (persist && !token) {
      this.storage.removeItem(this.options.storageKey!);
      this.emit('token:removed');
    }
    
    // If token is set, try to decode metadata
    if (token) {
      this.metadata = this.parseTokenMetadata(token);
      
      // Set up refresh timer if auto-refresh enabled
      if (this.options.autoRefresh && this.refreshConfig) {
        this.setupAutoRefresh();
      }
    } else {
      // Clear refresh timer if token is removed
      this.clearRefreshTimer();
    }
  }
  
  /**
   * Load the token from storage
   * @returns The loaded token or null if not available
   */
  public loadToken(): string | null {
    try {
      // Try to load from storage
      const token = this.storage.getItem(this.options.storageKey!);
      
      if (token) {
        // Set token without persisting (already persisted)
        this.setToken(token, false);
        this.emit('token:loaded', { token: this.getMaskedToken() });
        
        // Validate if needed
        if (this.options.validateOnLoad) {
          this.validate();
        }
        
        return token;
      }
    } catch (error) {
      this.log('Error loading token from storage', error);
    }
    
    return null;
  }
  
  /**
   * Remove the current token
   */
  public removeToken(): void {
    try {
      // Remove from storage
      this.storage.removeItem(this.options.storageKey!);
      
      // Clear from memory
      this.token = null;
      this.metadata = null;
      
      // Clear refresh timer
      this.clearRefreshTimer();
      
      this.emit('token:removed');
    } catch (error) {
      this.log('Error removing token', error);
    }
  }
  
  /**
   * Check if the token is valid
   * @returns Whether the token is valid
   */
  public isValid(): boolean {
    // No token
    if (!this.token) {
      return false;
    }
    
    // No expiry information, assume valid
    if (!this.metadata?.expires) {
      return true;
    }
    
    // Check expiry
    return this.metadata.expires > Date.now();
  }
  
  /**
   * Check if the token is expired
   * @returns Whether the token is expired
   */
  public isExpired(): boolean {
    // No token
    if (!this.token) {
      return true;
    }
    
    // No expiry information, assume not expired
    if (!this.metadata?.expires) {
      return false;
    }
    
    // Check expiry
    return this.metadata.expires <= Date.now();
  }
  
  /**
   * Check if the token needs refresh
   * @returns Whether the token needs refresh
   */
  public needsRefresh(): boolean {
    // No token
    if (!this.token) {
      return false;
    }
    
    // No expiry information, assume no refresh needed
    if (!this.metadata?.expires) {
      return false;
    }
    
    // Check if within refresh threshold
    return this.metadata.expires - Date.now() <= this.options.refreshThresholdMs!;
  }
  
  /**
   * Refresh the token
   * @returns Promise resolving to the new token or null if refresh failed
   */
  public async refresh(): Promise<string | null> {
    // No refresh config
    if (!this.refreshConfig) {
      this.log('No refresh configuration provided');
      return null;
    }
    
    // Already refreshing, return existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // Start refresh
    this.refreshing = true;
    this.emit('token:refresh:start');
    
    // Create refresh promise
    this.refreshPromise = this.performRefresh();
    
    try {
      // Wait for refresh to complete
      const newToken = await this.refreshPromise;
      
      // Update token if refresh successful
      if (newToken) {
        this.setToken(newToken);
        this.emit('token:refresh:success', { token: this.getMaskedToken() });
      } else {
        this.emit('token:refresh:failed', { reason: 'No token returned' });
      }
      
      return newToken;
    } catch (error) {
      this.log('Token refresh failed', error);
      this.emit('token:refresh:failed', { reason: String(error) });
      return null;
    } finally {
      // Reset refresh state
      this.refreshing = false;
      this.refreshPromise = null;
    }
  }
  
  /**
   * Validate the token with the server
   * @returns Promise resolving to whether the token is valid
   */
  public async validate(): Promise<boolean> {
    // No token
    if (!this.token) {
      return false;
    }
    
    // Check local expiry first
    if (this.metadata?.expires && this.metadata.expires <= Date.now()) {
      this.emit('token:expired');
      this.emit('token:validate:failed', { reason: 'Token expired' });
      return false;
    }
    
    // If no refresh config, assume valid
    if (!this.refreshConfig) {
      return true;
    }
    
    try {
      // Use the refresh URL for validation (usually the server will validate the token)
      const fetchFn = this.refreshConfig.fetchFn || fetch;
      const response = await fetchFn(this.refreshConfig.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          ...this.refreshConfig.headers
        },
        credentials: this.refreshConfig.credentials || 'include'
      });
      
      // Check if response indicates valid token
      const isValid = response.ok;
      
      if (isValid) {
        this.emit('token:validate:success');
      } else {
        this.emit('token:validate:failed', { reason: `HTTP ${response.status}` });
      }
      
      return isValid;
    } catch (error) {
      this.log('Token validation failed', error);
      this.emit('token:validate:failed', { reason: String(error) });
      return false;
    }
  }
  
  /**
   * Get token metadata
   * @returns Token metadata or null if not available
   */
  public getMetadata(): TokenMetadata | null {
    return this.metadata ? { ...this.metadata } : null;
  }
  
  /**
   * Register event handler
   * @param event Event name
   * @param listener Event callback
   */
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
  
  /**
   * Register one-time event handler
   * @param event Event name
   * @param listener Event callback
   */
  public once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }
  
  /**
   * Remove event handler
   * @param event Event name
   * @param listener Event callback
   */
  public off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }
  
  /**
   * Get a masked version of the token for logging
   * @returns Masked token
   */
  private getMaskedToken(): string {
    if (!this.token) {
      return '[none]';
    }
    
    if (this.token.length <= 16) {
      return '********';
    }
    
    return `${this.token.substring(0, 8)}...${this.token.substring(this.token.length - 4)}`;
  }
  
  /**
   * Perform the token refresh
   * @returns Promise resolving to the new token or null if refresh failed
   */
  private async performRefresh(): Promise<string | null> {
    if (!this.refreshConfig) {
      return null;
    }
    
    try {
      const fetchFn = this.refreshConfig.fetchFn || fetch;
      
      // Prepare request options
      const options: RequestInit = {
        method: this.refreshConfig.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.refreshConfig.headers
        },
        credentials: this.refreshConfig.credentials || 'include',
        body: this.refreshConfig.customPayload 
          ? JSON.stringify(this.refreshConfig.customPayload)
          : (this.token ? JSON.stringify({ token: this.token }) : undefined)
      };
      
      // Add current token to headers if available
      if (this.token) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${this.token}`
        };
      }
      
      // Make request
      const response = await fetchFn(this.refreshConfig.url, options);
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      // Parse response
      const data = await response.json();
      
      // Process response to extract token
      if (this.refreshConfig.responseProcessor) {
        return this.refreshConfig.responseProcessor(data);
      }
      
      // Default processing: look for token in response
      if (data.token) {
        return data.token;
      } else if (data.accessToken) {
        return data.accessToken;
      } else if (data.access_token) {
        return data.access_token;
      } else if (typeof data === 'string') {
        return data;
      }
      
      this.log('No token found in refresh response', data);
      return null;
    } catch (error) {
      this.log('Error refreshing token', error);
      throw error;
    }
  }
  
  /**
   * Parse token metadata
   * @param token Token to parse
   * @returns Token metadata
   */
  private parseTokenMetadata(token: string): TokenMetadata {
    try {
      // Default metadata
      const metadata: TokenMetadata = {
        isValid: true
      };
      
      // Try to parse JWT
      if (token.includes('.') && token.split('.').length === 3) {
        const [, payloadBase64] = token.split('.');
        
        // Decode payload
        const payloadJson = atob(this.base64UrlDecode(payloadBase64));
        const payload = JSON.parse(payloadJson);
        
        // Extract metadata
        if (payload.exp) {
          metadata.expires = payload.exp * 1000; // Convert seconds to milliseconds
        }
        
        if (payload.iat) {
          metadata.issuedAt = payload.iat * 1000; // Convert seconds to milliseconds
        }
        
        if (payload.sub) {
          metadata.userId = payload.sub;
        }
        
        if (payload.id) {
          metadata.userId = payload.id;
        }
        
        if (payload.user_id) {
          metadata.userId = payload.user_id;
        }
        
        if (payload.deviceId) {
          metadata.deviceId = payload.deviceId;
        }
        
        if (payload.device_id) {
          metadata.deviceId = payload.device_id;
        }
        
        if (payload.role) {
          metadata.role = payload.role;
        }
        
        // Check if token is expired
        if (metadata.expires && metadata.expires <= Date.now()) {
          metadata.isValid = false;
          this.emit('token:expired');
        }
      }
      
      return metadata;
    } catch (error) {
      this.log('Error parsing token metadata', error);
      return { isValid: false };
    }
  }
  
  /**
   * Set up auto-refresh based on token expiry
   */
  private setupAutoRefresh(): void {
    // Clear existing timer
    this.clearRefreshTimer();
    
    // No token or expiry
    if (!this.token || !this.metadata?.expires) {
      return;
    }
    
    // Calculate time until refresh
    const now = Date.now();
    const timeUntilRefresh = Math.max(
      0,
      this.metadata.expires - now - this.options.refreshThresholdMs!
    );
    
    // Set up refresh timer
    this.refreshTimer = setTimeout(() => {
      this.refresh();
    }, timeUntilRefresh);
    
    this.log(`Auto-refresh scheduled in ${Math.round(timeUntilRefresh / 1000)}s`);
  }
  
  /**
   * Clear the refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  
  /**
   * Decode base64url to base64
   * @param input Base64url encoded string
   * @returns Base64 decoded string
   */
  private base64UrlDecode(input: string): string {
    // Replace non-url compatible chars with base64 standard chars
    let output = input.replace(/-/g, '+').replace(/_/g, '/');
    
    // Pad out with standard base64 characters
    const pad = output.length % 4;
    if (pad) {
      if (pad === 1) {
        throw new Error('InvalidLengthError: base64url input cannot be 1 mod 4');
      }
      output += new Array(5 - pad).join('=');
    }
    
    return output;
  }
  
  /**
   * Log a message with service prefix
   * @param message Log message
   * @param args Additional arguments
   */
  private log(message: string, ...args: any[]): void {
    if (typeof console !== 'undefined') {
      console.log(`[${this.serviceName}] ${message}`, ...args);
    }
  }
} 

// Create and export a singleton instance
const tokenManager = new TokenManager();
export default tokenManager;