import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '@leaderprism/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.VALIDATION_ERROR;
    let message = 'Internal server error';
    let fields: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const r = exceptionResponse as Record<string, unknown>;
        message = (r['message'] as string) ?? exception.message;
        code = (r['error'] as string) ?? this.statusToCode(status);
        if (Array.isArray(r['message'])) {
          fields = this.parseValidationErrors(r['message'] as string[]);
          message = 'Validation failed';
          code = ErrorCode.VALIDATION_ERROR;
        }
      } else {
        message = exceptionResponse as string;
        code = this.statusToCode(status);
      }
    } else {
      this.logger.error(exception);
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
      },
      meta: { timestamp: new Date().toISOString(), path: request.url },
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: ErrorCode.VALIDATION_ERROR,
      401: ErrorCode.UNAUTHORISED,
      403: ErrorCode.FORBIDDEN,
      404: ErrorCode.NOT_FOUND,
      409: ErrorCode.CONFLICT,
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }

  private parseValidationErrors(messages: string[]): Record<string, string[]> {
    const fields: Record<string, string[]> = {};
    for (const msg of messages) {
      const [field, ...rest] = msg.split(' ');
      fields[field] = fields[field] ?? [];
      fields[field].push(rest.join(' '));
    }
    return fields;
  }
}
