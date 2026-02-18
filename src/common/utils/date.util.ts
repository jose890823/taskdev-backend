/**
 * Utilidades de fechas para el backend MiChambita.
 *
 * Politica estricta:
 * - Almacenamiento: Siempre UTC (timestamptz en PostgreSQL)
 * - Entrada: ISO 8601 (2026-02-07T15:30:00Z)
 * - Salida: ISO 8601 en UTC
 * - Conversiones de zona horaria solo en presentacion (frontend)
 */

/**
 * Retorna la fecha actual en UTC
 */
export function nowUTC(): Date {
  return new Date();
}

/**
 * Convierte cualquier fecha a UTC ISO string
 */
export function toUTCString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

/**
 * Verifica si una fecha ha expirado (comparada contra ahora en UTC)
 */
export function isExpired(date: Date | string | null | undefined): boolean {
  if (!date) return true;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date() > d;
}

/**
 * Agrega dias a una fecha
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Agrega horas a una fecha
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setUTCHours(result.getUTCHours() + hours);
  return result;
}

/**
 * Agrega minutos a una fecha
 */
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setUTCMinutes(result.getUTCMinutes() + minutes);
  return result;
}

/**
 * Diferencia en dias entre dos fechas (redondeado hacia abajo)
 */
export function diffInDays(dateA: Date, dateB: Date): number {
  const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Diferencia en horas entre dos fechas
 */
export function diffInHours(dateA: Date, dateB: Date): number {
  const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Retorna el inicio del dia en UTC
 */
export function startOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Retorna el fin del dia en UTC
 */
export function endOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}
