import { DisplayMetadata, DisplayRegistration, DisplayToken } from '../types/display';
import { z } from 'zod';

const TokenSchema = z.object({
  token: z.string(),
  expiresAt: z.string().transform(str => new Date(str)),
  displayId: z.string()
});

const RegistrationSchema = z.object({
  pairingCode: z.string().length(6),
  metadata: z.object({
    name: z.string(),
    location: z.string().optional(),
    resolution: z.object({
      width: z.number(),
      height: z.number()
    }).optional(),
    model: z.string().optional(),
    os: z.string().optional()
  })
});

export class DeviceAuth {
  private static readonly TOKEN_KEY = 'vizora_device_token';
  private static readonly DISPLAY_ID_KEY = 'vizora_display_id';

  static validateToken(token: unknown): DisplayToken {
    return TokenSchema.parse(token);
  }

  static validateRegistration(registration: unknown): DisplayRegistration {
    return RegistrationSchema.parse(registration);
  }

  static saveToken(token: DisplayToken): void {
    localStorage.setItem(this.TOKEN_KEY, JSON.stringify(token));
  }

  static getToken(): DisplayToken | null {
    const tokenStr = localStorage.getItem(this.TOKEN_KEY);
    if (!tokenStr) return null;

    try {
      const token = this.validateToken(JSON.parse(tokenStr));
      if (new Date() > token.expiresAt) {
        this.clearToken();
        return null;
      }
      return token;
    } catch {
      this.clearToken();
      return null;
    }
  }

  static clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static saveDisplayId(id: string): void {
    localStorage.setItem(this.DISPLAY_ID_KEY, id);
  }

  static getDisplayId(): string | null {
    return localStorage.getItem(this.DISPLAY_ID_KEY);
  }

  static clearDisplayId(): void {
    localStorage.removeItem(this.DISPLAY_ID_KEY);
  }

  static isAuthenticated(): boolean {
    return this.getToken() !== null && this.getDisplayId() !== null;
  }

  static clearAuth(): void {
    this.clearToken();
    this.clearDisplayId();
  }
} 