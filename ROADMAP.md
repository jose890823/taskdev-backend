# ROADMAP BACKEND - MiChambita

## Estado Actual: Infraestructura base lista
Fecha: 2026-02-13

---

## Modulos Base Disponibles

| Modulo | Estado | Descripcion |
|--------|--------|-------------|
| Auth | Listo | JWT, OTP, roles (super_admin, admin, client) |
| Users | Listo | CRUD, perfiles, preferencias |
| Email | Listo | Resend + Gmail SMTP con fallback |
| Storage | Listo | Modular: Local, S3, GCS, Cloudinary |
| Security | Listo | Rate limiting, sesiones, IP blocking |
| Notifications | Listo | In-app notifications |
| Cache | Listo | Redis cache, @Cacheable decorator |
| Jobs | Listo | Bull queue para jobs en background |
| Webhooks | Listo | Webhook resilience, idempotencia |
| I18n | Listo | Traducciones en BD (es/en) |
| Feature Flags | Listo | Flags con guard y decorator |

---

## Siguiente Paso
Disenar e implementar modulos de inventario.
