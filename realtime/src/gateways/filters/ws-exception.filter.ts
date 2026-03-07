import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsAllExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsAllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const eventName = host.switchToWs().getPattern();

    if (exception instanceof WsException) {
      const error = exception.getError();
      client.emit('error', {
        event: eventName,
        message: typeof error === 'string' ? error : (error as any)?.message || 'Validation error',
        details: typeof error === 'object' ? error : undefined,
      });
    } else {
      this.logger.error(
        `Unhandled WS exception on event "${eventName}": ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      client.emit('error', {
        event: eventName,
        message: 'Internal server error',
      });
    }
  }
}
