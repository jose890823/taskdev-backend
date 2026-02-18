/**
 * Utilidades para formateo de fechas sin conversión de timezone
 *
 * IMPORTANTE: Estas funciones parsean las fechas directamente sin usar new Date()
 * para evitar conversiones de zona horaria que pueden causar desfases.
 *
 * Referencia: ERR-101 en LEARNED_SOLUTIONS.md
 */

interface ParsedDateTime {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  isValid: boolean;
}

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Parsea una fecha ISO o timestamp sin conversión de timezone
 * Extrae los componentes directamente del string
 */
export function parseDateTime(
  dateInput: Date | string | null | undefined,
): ParsedDateTime {
  if (!dateInput) {
    return {
      year: 0,
      month: 0,
      day: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isValid: false,
    };
  }

  let dateString: string;

  // Si es un objeto Date, convertirlo a ISO string
  if (dateInput instanceof Date) {
    dateString = dateInput.toISOString();
  } else {
    dateString = String(dateInput);
  }

  // Intentar parsear formato ISO: 2025-12-16T10:00:00.000Z o 2025-12-16T10:00:00
  const isoMatch = dateString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/,
  );

  if (isoMatch) {
    const [, year, month, day, hours, minutes, seconds = '0'] = isoMatch;
    return {
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      day: parseInt(day, 10),
      hours: parseInt(hours, 10),
      minutes: parseInt(minutes, 10),
      seconds: parseInt(seconds, 10),
      isValid: true,
    };
  }

  // Intentar parsear formato solo fecha: 2025-12-16
  const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return {
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      day: parseInt(day, 10),
      hours: 0,
      minutes: 0,
      seconds: 0,
      isValid: true,
    };
  }

  return {
    year: 0,
    month: 0,
    day: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isValid: false,
  };
}

/**
 * Calcula el día de la semana (0-6, donde 0 es domingo)
 * Usa UTC para consistencia
 */
function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

/**
 * Formatea la fecha en inglés: "Monday, December 16, 2025"
 */
export function formatDateLongEn(
  dateInput: Date | string | null | undefined,
): string {
  const parsed = parseDateTime(dateInput);

  if (!parsed.isValid) {
    return 'Invalid date';
  }

  const dayOfWeek = getDayOfWeek(parsed.year, parsed.month, parsed.day);
  const dayName = DAY_NAMES_EN[dayOfWeek];
  const monthName = MONTH_NAMES_EN[parsed.month - 1];

  return `${dayName}, ${monthName} ${parsed.day}, ${parsed.year}`;
}

/**
 * Formatea la fecha corta en inglés: "12/16/2025" (MM/DD/YYYY)
 */
export function formatDateShortEn(
  dateInput: Date | string | null | undefined,
): string {
  const parsed = parseDateTime(dateInput);

  if (!parsed.isValid) {
    return 'Invalid date';
  }

  const month = String(parsed.month).padStart(2, '0');
  const day = String(parsed.day).padStart(2, '0');

  return `${month}/${day}/${parsed.year}`;
}

/**
 * Formatea la hora en formato 12h: "10:00 AM"
 */
export function formatTime12h(
  dateInput: Date | string | null | undefined,
): string {
  const parsed = parseDateTime(dateInput);

  if (!parsed.isValid) {
    return 'Invalid time';
  }

  const hours = parsed.hours;
  const minutes = String(parsed.minutes).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${hours12}:${minutes} ${period}`;
}

/**
 * Formatea la hora en formato 24h: "10:00"
 */
export function formatTime24h(
  dateInput: Date | string | null | undefined,
): string {
  const parsed = parseDateTime(dateInput);

  if (!parsed.isValid) {
    return 'Invalid time';
  }

  const hours = String(parsed.hours).padStart(2, '0');
  const minutes = String(parsed.minutes).padStart(2, '0');

  return `${hours}:${minutes}`;
}
