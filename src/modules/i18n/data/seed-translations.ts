export interface SeedTranslation {
  key: string;
  locale: 'es' | 'en';
  value: string;
  module: string;
  context?: string;
}

export const SEED_TRANSLATIONS: SeedTranslation[] = [
  // ============================================
  // ERRORS (module: 'errors')
  // ============================================

  // errors.not_found
  {
    key: 'errors.not_found',
    locale: 'es',
    value: 'Recurso no encontrado',
    module: 'errors',
    context: 'Error generico cuando un recurso no existe',
  },
  {
    key: 'errors.not_found',
    locale: 'en',
    value: 'Resource not found',
    module: 'errors',
    context: 'Generic error when a resource does not exist',
  },

  // errors.unauthorized
  {
    key: 'errors.unauthorized',
    locale: 'es',
    value: 'No autorizado',
    module: 'errors',
    context: 'Error de autenticacion',
  },
  {
    key: 'errors.unauthorized',
    locale: 'en',
    value: 'Unauthorized',
    module: 'errors',
    context: 'Authentication error',
  },

  // errors.forbidden
  {
    key: 'errors.forbidden',
    locale: 'es',
    value: 'No tienes permiso para esta accion',
    module: 'errors',
    context: 'Error de autorizacion',
  },
  {
    key: 'errors.forbidden',
    locale: 'en',
    value: "You don't have permission for this action",
    module: 'errors',
    context: 'Authorization error',
  },

  // errors.validation
  {
    key: 'errors.validation',
    locale: 'es',
    value: 'Los datos proporcionados no son validos',
    module: 'errors',
    context: 'Error de validacion de datos de entrada',
  },
  {
    key: 'errors.validation',
    locale: 'en',
    value: 'Invalid data provided',
    module: 'errors',
    context: 'Input data validation error',
  },

  // errors.conflict
  {
    key: 'errors.conflict',
    locale: 'es',
    value: 'El recurso ya existe',
    module: 'errors',
    context: 'Error de conflicto por duplicado',
  },
  {
    key: 'errors.conflict',
    locale: 'en',
    value: 'Resource already exists',
    module: 'errors',
    context: 'Duplicate conflict error',
  },

  // errors.internal
  {
    key: 'errors.internal',
    locale: 'es',
    value: 'Error interno del servidor',
    module: 'errors',
    context: 'Error inesperado del servidor',
  },
  {
    key: 'errors.internal',
    locale: 'en',
    value: 'Internal server error',
    module: 'errors',
    context: 'Unexpected server error',
  },

  // errors.user_not_found
  {
    key: 'errors.user_not_found',
    locale: 'es',
    value: 'Usuario no encontrado',
    module: 'errors',
    context: 'Cuando un usuario no existe en la base de datos',
  },
  {
    key: 'errors.user_not_found',
    locale: 'en',
    value: 'User not found',
    module: 'errors',
    context: 'When a user does not exist in the database',
  },

  // errors.store_not_found
  {
    key: 'errors.store_not_found',
    locale: 'es',
    value: 'Tienda no encontrada',
    module: 'errors',
    context: 'Cuando una tienda no existe',
  },
  {
    key: 'errors.store_not_found',
    locale: 'en',
    value: 'Store not found',
    module: 'errors',
    context: 'When a store does not exist',
  },

  // errors.product_not_found
  {
    key: 'errors.product_not_found',
    locale: 'es',
    value: 'Producto no encontrado',
    module: 'errors',
    context: 'Cuando un producto no existe',
  },
  {
    key: 'errors.product_not_found',
    locale: 'en',
    value: 'Product not found',
    module: 'errors',
    context: 'When a product does not exist',
  },

  // errors.order_not_found
  {
    key: 'errors.order_not_found',
    locale: 'es',
    value: 'Orden no encontrada',
    module: 'errors',
    context: 'Cuando una orden no existe',
  },
  {
    key: 'errors.order_not_found',
    locale: 'en',
    value: 'Order not found',
    module: 'errors',
    context: 'When an order does not exist',
  },

  // errors.insufficient_stock
  {
    key: 'errors.insufficient_stock',
    locale: 'es',
    value: 'Stock insuficiente',
    module: 'errors',
    context: 'Cuando no hay suficiente inventario',
  },
  {
    key: 'errors.insufficient_stock',
    locale: 'en',
    value: 'Insufficient stock',
    module: 'errors',
    context: 'When there is not enough inventory',
  },

  // errors.invalid_coupon
  {
    key: 'errors.invalid_coupon',
    locale: 'es',
    value: 'Cupon invalido o expirado',
    module: 'errors',
    context: 'Cuando un cupon no es valido o ya expiro',
  },
  {
    key: 'errors.invalid_coupon',
    locale: 'en',
    value: 'Invalid or expired coupon',
    module: 'errors',
    context: 'When a coupon is not valid or has expired',
  },

  // errors.cart_empty
  {
    key: 'errors.cart_empty',
    locale: 'es',
    value: 'El carrito esta vacio',
    module: 'errors',
    context: 'Cuando se intenta procesar un carrito vacio',
  },
  {
    key: 'errors.cart_empty',
    locale: 'en',
    value: 'Cart is empty',
    module: 'errors',
    context: 'When trying to process an empty cart',
  },

  // ============================================
  // NOTIFICATIONS (module: 'notifications')
  // ============================================

  // notifications.order_placed.title
  {
    key: 'notifications.order_placed.title',
    locale: 'es',
    value: 'Orden realizada',
    module: 'notifications',
    context: 'Titulo de notificacion cuando se crea una orden',
  },
  {
    key: 'notifications.order_placed.title',
    locale: 'en',
    value: 'Order placed',
    module: 'notifications',
    context: 'Notification title when an order is created',
  },

  // notifications.order_placed.body
  {
    key: 'notifications.order_placed.body',
    locale: 'es',
    value: 'Tu orden {{orderNumber}} ha sido recibida',
    module: 'notifications',
    context:
      'Cuerpo de notificacion de orden recibida. Params: {{orderNumber}}',
  },
  {
    key: 'notifications.order_placed.body',
    locale: 'en',
    value: 'Your order {{orderNumber}} has been received',
    module: 'notifications',
    context: 'Order received notification body. Params: {{orderNumber}}',
  },

  // notifications.order_shipped.title
  {
    key: 'notifications.order_shipped.title',
    locale: 'es',
    value: 'Orden enviada',
    module: 'notifications',
    context: 'Titulo de notificacion cuando se envia una orden',
  },
  {
    key: 'notifications.order_shipped.title',
    locale: 'en',
    value: 'Order shipped',
    module: 'notifications',
    context: 'Notification title when an order is shipped',
  },

  // notifications.order_shipped.body
  {
    key: 'notifications.order_shipped.body',
    locale: 'es',
    value: 'Tu orden {{orderNumber}} ha sido enviada',
    module: 'notifications',
    context: 'Cuerpo de notificacion de orden enviada. Params: {{orderNumber}}',
  },
  {
    key: 'notifications.order_shipped.body',
    locale: 'en',
    value: 'Your order {{orderNumber}} has been shipped',
    module: 'notifications',
    context: 'Order shipped notification body. Params: {{orderNumber}}',
  },

  // notifications.order_delivered.title
  {
    key: 'notifications.order_delivered.title',
    locale: 'es',
    value: 'Orden entregada',
    module: 'notifications',
    context: 'Titulo de notificacion cuando se entrega una orden',
  },
  {
    key: 'notifications.order_delivered.title',
    locale: 'en',
    value: 'Order delivered',
    module: 'notifications',
    context: 'Notification title when an order is delivered',
  },

  // notifications.store_approved.title
  {
    key: 'notifications.store_approved.title',
    locale: 'es',
    value: 'Tienda aprobada',
    module: 'notifications',
    context: 'Titulo de notificacion cuando se aprueba una tienda',
  },
  {
    key: 'notifications.store_approved.title',
    locale: 'en',
    value: 'Store approved',
    module: 'notifications',
    context: 'Notification title when a store is approved',
  },

  // notifications.store_approved.body
  {
    key: 'notifications.store_approved.body',
    locale: 'es',
    value: 'Tu tienda {{storeName}} ha sido aprobada',
    module: 'notifications',
    context: 'Cuerpo de notificacion de tienda aprobada. Params: {{storeName}}',
  },
  {
    key: 'notifications.store_approved.body',
    locale: 'en',
    value: 'Your store {{storeName}} has been approved',
    module: 'notifications',
    context: 'Store approved notification body. Params: {{storeName}}',
  },

  // notifications.new_review.title
  {
    key: 'notifications.new_review.title',
    locale: 'es',
    value: 'Nueva resena',
    module: 'notifications',
    context: 'Titulo de notificacion de nueva resena',
  },
  {
    key: 'notifications.new_review.title',
    locale: 'en',
    value: 'New review',
    module: 'notifications',
    context: 'New review notification title',
  },

  // notifications.payout_processed.title
  {
    key: 'notifications.payout_processed.title',
    locale: 'es',
    value: 'Pago procesado',
    module: 'notifications',
    context: 'Titulo de notificacion de pago procesado al vendedor',
  },
  {
    key: 'notifications.payout_processed.title',
    locale: 'en',
    value: 'Payout processed',
    module: 'notifications',
    context: 'Payout processed notification title',
  },

  // notifications.price_drop.title
  {
    key: 'notifications.price_drop.title',
    locale: 'es',
    value: 'Baja de precio',
    module: 'notifications',
    context: 'Titulo de notificacion de baja de precio',
  },
  {
    key: 'notifications.price_drop.title',
    locale: 'en',
    value: 'Price drop',
    module: 'notifications',
    context: 'Price drop notification title',
  },

  // notifications.price_drop.body
  {
    key: 'notifications.price_drop.body',
    locale: 'es',
    value: '{{productName}} bajo de precio',
    module: 'notifications',
    context:
      'Cuerpo de notificacion de baja de precio. Params: {{productName}}',
  },
  {
    key: 'notifications.price_drop.body',
    locale: 'en',
    value: '{{productName}} price dropped',
    module: 'notifications',
    context: 'Price drop notification body. Params: {{productName}}',
  },

  // ============================================
  // COMMON (module: 'common')
  // ============================================

  // common.success
  {
    key: 'common.success',
    locale: 'es',
    value: 'Operacion realizada exitosamente',
    module: 'common',
    context: 'Mensaje generico de exito',
  },
  {
    key: 'common.success',
    locale: 'en',
    value: 'Operation completed successfully',
    module: 'common',
    context: 'Generic success message',
  },

  // common.created
  {
    key: 'common.created',
    locale: 'es',
    value: 'Creado exitosamente',
    module: 'common',
    context: 'Mensaje generico de creacion exitosa',
  },
  {
    key: 'common.created',
    locale: 'en',
    value: 'Created successfully',
    module: 'common',
    context: 'Generic creation success message',
  },

  // common.updated
  {
    key: 'common.updated',
    locale: 'es',
    value: 'Actualizado exitosamente',
    module: 'common',
    context: 'Mensaje generico de actualizacion exitosa',
  },
  {
    key: 'common.updated',
    locale: 'en',
    value: 'Updated successfully',
    module: 'common',
    context: 'Generic update success message',
  },

  // common.deleted
  {
    key: 'common.deleted',
    locale: 'es',
    value: 'Eliminado exitosamente',
    module: 'common',
    context: 'Mensaje generico de eliminacion exitosa',
  },
  {
    key: 'common.deleted',
    locale: 'en',
    value: 'Deleted successfully',
    module: 'common',
    context: 'Generic deletion success message',
  },

  // common.welcome
  {
    key: 'common.welcome',
    locale: 'es',
    value: 'Bienvenido a MiChambita',
    module: 'common',
    context: 'Mensaje de bienvenida general',
  },
  {
    key: 'common.welcome',
    locale: 'en',
    value: 'Welcome to MiChambita',
    module: 'common',
    context: 'General welcome message',
  },

  // ============================================
  // EMAILS (module: 'emails')
  // ============================================

  // emails.welcome.subject
  {
    key: 'emails.welcome.subject',
    locale: 'es',
    value: 'Bienvenido a MiChambita',
    module: 'emails',
    context: 'Asunto del email de bienvenida',
  },
  {
    key: 'emails.welcome.subject',
    locale: 'en',
    value: 'Welcome to MiChambita',
    module: 'emails',
    context: 'Welcome email subject',
  },

  // emails.order_confirmation.subject
  {
    key: 'emails.order_confirmation.subject',
    locale: 'es',
    value: 'Confirmacion de orden {{orderNumber}}',
    module: 'emails',
    context:
      'Asunto del email de confirmacion de orden. Params: {{orderNumber}}',
  },
  {
    key: 'emails.order_confirmation.subject',
    locale: 'en',
    value: 'Order confirmation {{orderNumber}}',
    module: 'emails',
    context: 'Order confirmation email subject. Params: {{orderNumber}}',
  },

  // emails.password_reset.subject
  {
    key: 'emails.password_reset.subject',
    locale: 'es',
    value: 'Restablecer contrasena',
    module: 'emails',
    context: 'Asunto del email de restablecimiento de contrasena',
  },
  {
    key: 'emails.password_reset.subject',
    locale: 'en',
    value: 'Reset password',
    module: 'emails',
    context: 'Password reset email subject',
  },

  // emails.otp.subject
  {
    key: 'emails.otp.subject',
    locale: 'es',
    value: 'Tu codigo de verificacion',
    module: 'emails',
    context: 'Asunto del email con codigo OTP',
  },
  {
    key: 'emails.otp.subject',
    locale: 'en',
    value: 'Your verification code',
    module: 'emails',
    context: 'OTP code email subject',
  },
];
