import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ============================================
 * ESTRUCTURA ESTÁNDAR DE RESPUESTAS API
 * ============================================
 *
 * RESPUESTA EXITOSA:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "message": "Operación exitosa",
 *   "timestamp": "2026-02-04T12:00:00.000Z",
 *   "path": "/api/v1/courses"
 * }
 *
 * RESPUESTA DE ERROR:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "COURSE_NOT_FOUND",
 *     "message": "El curso no fue encontrado",
 *     "details": { ... }
 *   },
 *   "timestamp": "2026-02-04T12:00:00.000Z",
 *   "path": "/api/v1/courses/123"
 * }
 */

// ============================================
// RESPUESTA EXITOSA
// ============================================

export class SuccessResponseDto<T = any> {
  @ApiProperty({
    example: true,
    description: 'Indica que la operación fue exitosa',
    enum: [true],
  })
  success: true;

  @ApiProperty({
    description: 'Datos de la respuesta (puede ser objeto, array, o null)',
  })
  data: T;

  @ApiProperty({
    example: 'Operación realizada exitosamente',
    description: 'Mensaje descriptivo de la operación',
  })
  message: string;

  @ApiProperty({
    example: '2026-02-04T12:00:00.000Z',
    description: 'Timestamp ISO 8601 de la respuesta',
  })
  timestamp: string;

  @ApiProperty({
    example: '/api/v1/courses',
    description: 'Ruta de la petición',
  })
  path: string;
}

// ============================================
// RESPUESTA CON PAGINACIÓN
// ============================================

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Página actual' })
  page: number;

  @ApiProperty({ example: 20, description: 'Elementos por página' })
  limit: number;

  @ApiProperty({ example: 150, description: 'Total de elementos' })
  total: number;

  @ApiProperty({ example: 8, description: 'Total de páginas' })
  totalPages: number;

  @ApiProperty({ example: true, description: 'Si hay página siguiente' })
  hasNextPage: boolean;

  @ApiProperty({ example: false, description: 'Si hay página anterior' })
  hasPrevPage: boolean;
}

export class CursorPaginationMetaDto {
  @ApiPropertyOptional({
    example: 'eyJpZCI6IjEyMyJ9',
    description: 'Cursor para la siguiente página (null si no hay más)',
  })
  nextCursor: string | null;

  @ApiProperty({ example: true, description: 'Si hay más elementos' })
  hasMore: boolean;
}

export class PaginatedResponseDto<T = any> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ description: 'Array de elementos' })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({ example: 'Listado obtenido exitosamente' })
  message: string;

  @ApiProperty({ example: '2026-02-04T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/courses' })
  path: string;
}

// ============================================
// RESPUESTA DE ERROR
// ============================================

export class ErrorDetailDto {
  @ApiProperty({
    example: 'COURSE_NOT_FOUND',
    description:
      'Código único del error (prefijo por dominio: AUTH_, USER_, COURSE_, etc.)',
  })
  code: string;

  @ApiProperty({
    example: 'El curso solicitado no fue encontrado',
    description: 'Mensaje descriptivo del error para el usuario',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Detalles adicionales del error (validación, contexto, etc.)',
    example: { field: 'email', reason: 'Formato inválido' },
  })
  details?: Record<string, any> | null;
}

export class ErrorResponseDto {
  @ApiProperty({
    example: false,
    description: 'Indica que la operación falló',
    enum: [false],
  })
  success: false;

  @ApiProperty({
    type: ErrorDetailDto,
    description: 'Información del error',
  })
  error: ErrorDetailDto;

  @ApiProperty({
    example: '2026-02-04T12:00:00.000Z',
    description: 'Timestamp ISO 8601 de la respuesta',
  })
  timestamp: string;

  @ApiProperty({
    example: '/api/v1/courses/123',
    description: 'Ruta de la petición que falló',
  })
  path: string;
}

// ============================================
// CÓDIGOS DE ERROR POR DOMINIO
// ============================================

/**
 * Códigos de error estandarizados por dominio.
 * Usar estos códigos en lugar de strings arbitrarios.
 */
export const ErrorCodes = {
  // Errores generales
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // AUTH - Autenticación
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_ACCOUNT_INACTIVE: 'AUTH_ACCOUNT_INACTIVE',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_IP_BLOCKED: 'AUTH_IP_BLOCKED',
  AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',
  AUTH_OTP_EXPIRED: 'AUTH_OTP_EXPIRED',
  AUTH_OTP_INVALID: 'AUTH_OTP_INVALID',
  AUTH_OTP_MAX_ATTEMPTS: 'AUTH_OTP_MAX_ATTEMPTS',
  AUTH_SESSION_NOT_FOUND: 'AUTH_SESSION_NOT_FOUND',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',

  // USER - Usuarios
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_EMAIL_TAKEN: 'USER_EMAIL_TAKEN',
  USER_INACTIVE: 'USER_INACTIVE',

  // PAYMENT - Pagos
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_CARD_DECLINED: 'PAYMENT_CARD_DECLINED',
  PAYMENT_INSUFFICIENT_FUNDS: 'PAYMENT_INSUFFICIENT_FUNDS',
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_ALREADY_PROCESSED',

  // NOTIFICATION - Notificaciones
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  NOTIFICATION_ALREADY_READ: 'NOTIFICATION_ALREADY_READ',
  NOTIFICATION_SEND_FAILED: 'NOTIFICATION_SEND_FAILED',

  // STORE - Tiendas
  STORE_NOT_FOUND: 'STORE_NOT_FOUND',
  STORE_NOT_ACTIVE: 'STORE_NOT_ACTIVE',
  STORE_SUSPENDED: 'STORE_SUSPENDED',
  STORE_ALREADY_EXISTS: 'STORE_ALREADY_EXISTS',
  STORE_APPLICATION_NOT_FOUND: 'STORE_APPLICATION_NOT_FOUND',
  STORE_APPLICATION_ALREADY_EXISTS: 'STORE_APPLICATION_ALREADY_EXISTS',
  STORE_APPLICATION_ALREADY_REVIEWED: 'STORE_APPLICATION_ALREADY_REVIEWED',
  STORE_NOT_OWNER: 'STORE_NOT_OWNER',

  // PRODUCT - Productos
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_NOT_ACTIVE: 'PRODUCT_NOT_ACTIVE',
  PRODUCT_OUT_OF_STOCK: 'PRODUCT_OUT_OF_STOCK',
  PRODUCT_INSUFFICIENT_STOCK: 'PRODUCT_INSUFFICIENT_STOCK',
  PRODUCT_VARIANT_NOT_FOUND: 'PRODUCT_VARIANT_NOT_FOUND',
  PRODUCT_SKU_NOT_FOUND: 'PRODUCT_SKU_NOT_FOUND',
  PRODUCT_SKU_DUPLICATE: 'PRODUCT_SKU_DUPLICATE',
  PRODUCT_MIN_ORDER_NOT_MET: 'PRODUCT_MIN_ORDER_NOT_MET',

  // CATEGORY - Categorias
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CATEGORY_HAS_CHILDREN: 'CATEGORY_HAS_CHILDREN',
  CATEGORY_HAS_PRODUCTS: 'CATEGORY_HAS_PRODUCTS',
  CATEGORY_SLUG_EXISTS: 'CATEGORY_SLUG_EXISTS',

  // ORDER - Ordenes
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_INVALID_STATUS_TRANSITION: 'ORDER_INVALID_STATUS_TRANSITION',
  ORDER_CANNOT_CANCEL: 'ORDER_CANNOT_CANCEL',
  ORDER_ALREADY_COMPLETED: 'ORDER_ALREADY_COMPLETED',
  ORDER_ITEM_NOT_FOUND: 'ORDER_ITEM_NOT_FOUND',

  // CART - Carrito
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  CART_EMPTY: 'CART_EMPTY',
  CART_ITEM_NOT_FOUND: 'CART_ITEM_NOT_FOUND',
  CART_EXPIRED: 'CART_EXPIRED',

  // SHIPPING - Envios
  SHIPPING_ZONE_NOT_FOUND: 'SHIPPING_ZONE_NOT_FOUND',
  SHIPPING_RATE_NOT_FOUND: 'SHIPPING_RATE_NOT_FOUND',
  SHIPPING_NOT_AVAILABLE: 'SHIPPING_NOT_AVAILABLE',
  SHIPMENT_NOT_FOUND: 'SHIPMENT_NOT_FOUND',

  // REVIEW - Resenas
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  REVIEW_ALREADY_EXISTS: 'REVIEW_ALREADY_EXISTS',
  REVIEW_NOT_ALLOWED: 'REVIEW_NOT_ALLOWED',
  REVIEW_NOT_OWNER: 'REVIEW_NOT_OWNER',

  // COUPON - Cupones
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_USAGE_LIMIT_REACHED: 'COUPON_USAGE_LIMIT_REACHED',
  COUPON_NOT_APPLICABLE: 'COUPON_NOT_APPLICABLE',
  COUPON_MIN_AMOUNT_NOT_MET: 'COUPON_MIN_AMOUNT_NOT_MET',

  // COMMISSION - Comisiones
  COMMISSION_RULE_NOT_FOUND: 'COMMISSION_RULE_NOT_FOUND',
  PAYOUT_NOT_FOUND: 'PAYOUT_NOT_FOUND',
  PAYOUT_ALREADY_PROCESSED: 'PAYOUT_ALREADY_PROCESSED',

  // DISPUTE - Disputas
  DISPUTE_NOT_FOUND: 'DISPUTE_NOT_FOUND',
  DISPUTE_ALREADY_RESOLVED: 'DISPUTE_ALREADY_RESOLVED',
  DISPUTE_ACCESS_DENIED: 'DISPUTE_ACCESS_DENIED',

  // WISHLIST - Lista de deseos
  WISHLIST_NOT_FOUND: 'WISHLIST_NOT_FOUND',
  WISHLIST_ITEM_EXISTS: 'WISHLIST_ITEM_EXISTS',

  // ADDRESS - Direcciones
  ADDRESS_NOT_FOUND: 'ADDRESS_NOT_FOUND',
  ADDRESS_NOT_OWNER: 'ADDRESS_NOT_OWNER',

  // FEATURE FLAG - Feature flags
  FEATURE_FLAG_NOT_FOUND: 'FEATURE_FLAG_NOT_FOUND',
  FEATURE_DISABLED: 'FEATURE_DISABLED',

  // PICKUP - Retiro en almacen
  PICKUP_LOCATION_NOT_FOUND: 'PICKUP_LOCATION_NOT_FOUND',
  PICKUP_NOT_AVAILABLE: 'PICKUP_NOT_AVAILABLE',

  // STRIPE CONNECT
  STRIPE_CONNECT_NOT_CONFIGURED: 'STRIPE_CONNECT_NOT_CONFIGURED',
  STRIPE_CONNECT_ACCOUNT_NOT_FOUND: 'STRIPE_CONNECT_ACCOUNT_NOT_FOUND',
  STRIPE_TRANSFER_FAILED: 'STRIPE_TRANSFER_FAILED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================
// TIPOS PARA TYPESCRIPT
// ============================================

/**
 * Tipo genérico para respuestas exitosas
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
  path: string;
}

/**
 * Tipo genérico para respuestas de error
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any> | null;
  };
  timestamp: string;
  path: string;
}

/**
 * Tipo genérico para respuestas paginadas
 */
export interface ApiPaginatedResponse<T = any> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  message: string;
  timestamp: string;
  path: string;
}

/**
 * Tipo union para cualquier respuesta API
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// HELPERS PARA CREAR RESPUESTAS (uso en services/controllers)
// ============================================

/**
 * Helper para crear respuesta exitosa (usar en servicios si es necesario)
 */
export function createSuccessResponse<T>(
  data: T,
  message: string,
  path: string,
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    path,
  };
}

/**
 * Helper para crear respuesta de error (usar en filtros de excepción)
 */
export function createErrorResponse(
  code: string,
  message: string,
  path: string,
  details?: Record<string, any> | null,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details: details || null,
    },
    timestamp: new Date().toISOString(),
    path,
  };
}

// ============================================
// DEPRECATED - Mantener por compatibilidad
// ============================================

/** @deprecated Usar SuccessResponseDto en su lugar */
export class StandardResponseDto<T = any> extends SuccessResponseDto<T> {}

/** @deprecated Usar ErrorDetailDto en su lugar */
export class ErrorDetailsDto extends ErrorDetailDto {}
