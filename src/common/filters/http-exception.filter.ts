import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unhandled exception',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      !Array.isArray(exceptionResponse)
        ? exceptionResponse
        : { statusCode: status, message: exceptionResponse };

    response.status(status).json({
      ...body,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
