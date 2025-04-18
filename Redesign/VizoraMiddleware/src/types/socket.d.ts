import { Socket as BaseSocket } from 'socket.io';
import { UserDocument } from './models/User'; // Assuming UserDocument is the type for user

// Define the structure for user information attached to the socket
interface SocketUserData {
  id: string;
  role: string;
  // Add other relevant user fields if needed
}

// Extend the base Socket interface
export interface ExtendedSocket extends BaseSocket {
  // Custom properties added during authentication/connection
  deviceId?: string;
  deviceType?: 'display' | 'admin' | 'unknown';
  user?: SocketUserData | UserDocument | null; // Allow different user types or null
  authenticated?: boolean;
  
  // Potential custom methods (ensure these actually exist on the socket object)
  // ping?: () => void;
  // leave?: (room: string) => Promise<void> | void; 
} 