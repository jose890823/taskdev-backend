import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse, ErrorCodes } from '../dto/standard-response.dto';

/**
 * Mapeo de HttpStatus a códigos de error estándar
 */
const STATUS_TO_ERROR_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ErrorCodes.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCodes.AUTH_TOKEN_INVALID,
  [HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCodes.VALIDATION_ERROR,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.RATE_LIMITED,
  [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCodes.INTERNAL_SERVER_ERROR,
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/**
 * Filtro global de excepciones HTTP
 *
 * Convierte TODAS las excepciones al formato estándar de error:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Mensaje descriptivo",
 *     "details": { ... } // opcional
 *   },
 *   "timestamp": "ISO-8601",
 *   "path": "/api/v1/endpoint"
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.extractErrorInfo(exception);

    // Log del error (más detallado en desarrollo)
    this.logError(exception, status, request);

    // Respuesta estandarizada
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Extrae información del error de forma consistente
   */
  private extractErrorInfo(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details: Record<string, any> | null;
  } {
    // Caso 1: HttpException de NestJS
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Si la respuesta es un string
      if (typeof exceptionResponse === 'string') {
        return {
          status,
          code: STATUS_TO_ERROR_CODE[status] || 'HTTP_ERROR',
          message: exceptionResponse,
          details: null,
        };
      }

      // Si la respuesta es un objeto
      const responseObj = exceptionResponse as Record<string, any>;

      // Extraer código de error (prioridad: code > error > statusCode)
      const code =
        responseObj.code ||
        responseObj.error ||
        STATUS_TO_ERROR_CODE[status] ||
        'HTTP_ERROR';

      // Extraer mensaje (manejar arrays de validación)
      let message = responseObj.message;
      if (Array.isArray(message)) {
        message = message.join('. ');
      }
      message = message || exception.message || 'Error en la solicitud';

      // Extraer detalles adicionales (excluir campos ya procesados)
      const {
        code: _,
        message: __,
        error: ___,
        statusCode: ____,
        ...rest
      } = responseObj;
      const details = Object.keys(rest).length > 0 ? rest : null;

      return { status, code, message, details };
    }

    // Caso 2: Error genérico de JavaScript
    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message:
          process.env.NODE_ENV === 'development'
            ? exception.message
            : 'Error interno del servidor',
        details:
          process.env.NODE_ENV === 'development'
            ? {
                name: exception.name,
                stack: exception.stack?.split('\n').slice(0, 5),
              }
            : null,
      };
    }

    // Caso 3: Error desconocido
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
      details: null,
    };
  }

  /**
   * Log del error con nivel apropiado
   */
  private logError(exception: unknown, status: number, request: Request): void {
    const logContext = {
      path: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };

    // Errores 5xx son más graves
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
        JSON.stringify(logContext),
      );
    } else if (status >= 400) {
      // Errores 4xx son informativos
      this.logger.warn(
        `[${request.method}] ${request.url} - ${status}`,
        JSON.stringify(logContext),
      );
    }
  }
}
