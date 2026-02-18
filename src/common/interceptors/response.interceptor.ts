import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiSuccessResponse } from '../dto/standard-response.dto';

/**
 * Interceptor global de respuestas exitosas
 *
 * Convierte TODAS las respuestas exitosas al formato estándar:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "message": "Mensaje descriptivo",
 *   "timestamp": "ISO-8601",
 *   "path": "/api/v1/endpoint"
 * }
 *
 * Casos especiales que maneja:
 * 1. Respuesta ya formateada con { data, message } - Solo agrega metadatos
 * 2. Respuesta con paginación { data, pagination, message } - Preserva pagination
 * 3. Respuesta raw (objeto, array, primitivo) - Envuelve en estructura estándar
 * 4. null/undefined - Retorna data: null
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url;
    const timestamp = new Date().toISOString();

    return next.handle().pipe(
      map((responseData) => {
        // Caso 1: Respuesta null o undefined
        if (responseData === null || responseData === undefined) {
          return {
            success: true as const,
            data: null as T,
            message: 'Operación completada',
            timestamp,
            path,
          };
        }

        // Caso 2: Ya tiene el formato completo (incluye success: true)
        if (this.isAlreadyFormatted(responseData)) {
          return {
            ...responseData,
            success: true as const,
            timestamp,
            path,
          };
        }

        // Caso 3: Formato parcial con { data, message } o { data, pagination }
        if (this.isPartiallyFormatted(responseData)) {
          return {
            success: true as const,
            data: responseData.data,
            ...(responseData.pagination && {
              pagination: responseData.pagination,
            }),
            message: responseData.message || 'Operación realizada exitosamente',
            timestamp,
            path,
          };
        }

        // Caso 4: Respuesta raw (objeto, array, primitivo)
        return {
          success: true as const,
          data: responseData,
          message: this.getDefaultMessage(request.method),
          timestamp,
          path,
        };
      }),
    );
  }

  /**
   * Verifica si la respuesta ya tiene el formato completo
   */
  private isAlreadyFormatted(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      'success' in data &&
      data.success === true &&
      'data' in data
    );
  }

  /**
   * Verifica si la respuesta tiene formato parcial { data, message? }
   */
  private isPartiallyFormatted(data: any): boolean {
    return (
      data && typeof data === 'object' && 'data' in data && !('success' in data)
    );
  }

  /**
   * Mensaje por defecto según el método HTTP
   */
  private getDefaultMessage(method: string): string {
    const messages: Record<string, string> = {
      GET: 'Datos obtenidos exitosamente',
      POST: 'Recurso creado exitosamente',
      PUT: 'Recurso actualizado exitosamente',
      PATCH: 'Recurso actualizado exitosamente',
      DELETE: 'Recurso eliminado exitosamente',
    };
    return messages[method] || 'Operación realizada exitosamente';
  }
}
