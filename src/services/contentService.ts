import { io, Socket } from 'socket.io-client';

const VIZORA_TV_URL = 'http://localhost:3003';

export interface ContentUpdate {
  type: 'image' | 'video' | 'text' | 'html';
  content: {
    url?: string;
    text?: string;
    html?: string;
    fontSize?: string;
  };
}

class ContentService {
  private socket: Socket | null = null;

  constructor() {
    console.log('Initializing ContentService...');
    this.socket = io(VIZORA_TV_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to VizoraTV server for content updates');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Content service connection error:', error);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from VizoraTV server for content updates');
    });
  }

  async pushContent(displayId: string, content: ContentUpdate): Promise<boolean> {
    console.log('Attempting to push content:', { displayId, content });
    try {
      const url = `/api/content/${displayId}`; // Use relative URL for proxy
      console.log('Sending request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(content),
      });

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to push content: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error pushing content:', error);
      return false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const contentService = new ContentService(); 