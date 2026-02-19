const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Determina si un string es un UUID valido (v1-v5)
 */
export function isUuid(str: string): boolean {
  return UUID_REGEX.test(str);
}
