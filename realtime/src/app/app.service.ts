import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus(): { message: string } {
    return { message: 'Vizora Realtime Gateway is running' };
  }
}
