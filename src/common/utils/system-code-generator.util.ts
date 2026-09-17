import * as crypto from 'crypto';

/**
 * Generador de codigos del sistema para entidades
 *
 * Formato: {PREFIX}-{YYMMDD}-{XXXX}
 * - PREFIX: 3 letras identificadoras del tipo de entidad
 * - YYMMDD: Fecha de creacion compacta
 * - XXXX: 4 caracteres alfanumericos aleatorios (A-Z, 0-9)
 *
 * Ejemplo: USR-260205-A3K9
 *
 * Con 36^4 = 1,679,616 combinaciones por entidad por dia,
 * la probabilidad de colision es practicamente nula.
 * El constraint UNIQUE en BD actua como red de seguridad.
 */

export const ENTITY_PREFIX_MAP: Record<string, string> = {
  // Base
  User: 'USR',
  Notification: 'NTF',
  FeatureFlag: 'FLG',
  WebhookEvent: 'WHK',

  // Infra
  Translation: 'TRL',

  // TaskHub
  Organization: 'ORG',
  Invitation: 'INV',
  Project: 'PRJ',
  ProjectModule: 'PMD',
  Task: 'TSK',
  Comment: 'CMT',
  ActivityLog: 'ACT',
};

const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Genera 'length' caracteres alfanumericos aleatorios (A-Z, 0-9)
 * Uses crypto.randomBytes for cryptographically secure randomness.
 */
function generateRandomChars(length: number): string {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => ALPHANUMERIC_CHARS[b % ALPHANUMERIC_CHARS.length])
    .join('');
}

/**
 * Genera un codigo del sistema para una entidad
 *
 * @param entityName - Nombre de la clase de entidad (ej: 'User', 'Course')
 * @returns Codigo en formato {PREFIX}-{YYMMDD}-{XXXX}
 * @throws Error si el entityName no tiene un prefijo configurado
 *
 * @example
 * generateSystemCode('User')    // 'USR-260205-A3K9'
 * generateSystemCode('Course')  // 'CRS-260110-B7M2'
 */
export function generateSystemCode(entityName: string): string {
  const prefix = ENTITY_PREFIX_MAP[entityName];
  if (!prefix) {
    throw new Error(
      `No se encontro prefijo para la entidad "${entityName}". ` +
        `Entidades disponibles: ${Object.keys(ENTITY_PREFIX_MAP).join(', ')}`,
    );
  }

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  const randomPart = generateRandomChars(4);

  return `${prefix}-${dateStr}-${randomPart}`;
}
