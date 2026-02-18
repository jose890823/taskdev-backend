// ============================================
// EXPORTACIONES DE DTOs ESTÁNDAR
// ============================================

export {
  // DTOs de respuesta exitosa
  SuccessResponseDto,
  PaginatedResponseDto,
  PaginationMetaDto,
  CursorPaginationMetaDto,

  // DTOs de respuesta de error
  ErrorResponseDto,
  ErrorDetailDto,

  // Códigos de error estándar
  ErrorCodes,
  type ErrorCode,

  // Tipos TypeScript
  type ApiSuccessResponse,
  type ApiErrorResponse,
  type ApiPaginatedResponse,
  type ApiResponse,

  // Helpers
  createSuccessResponse,
  createErrorResponse,

  // Deprecated (mantener por compatibilidad)
  StandardResponseDto,
  ErrorDetailsDto,
} from './standard-response.dto';

export { PaginationQueryDto, SortOrder } from './pagination-query.dto';
