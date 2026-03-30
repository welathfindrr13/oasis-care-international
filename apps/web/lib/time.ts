/**
 * Time utilities for Oasis Care application
 * Default timezone: Europe/London
 */

const LONDON_TIMEZONE = 'Europe/London';

function getDateTimePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  }).formatToParts(date);

  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return {
    year: Number.parseInt(lookup.year, 10),
    month: Number.parseInt(lookup.month, 10),
    day: Number.parseInt(lookup.day, 10),
    hour: Number.parseInt(lookup.hour, 10),
    minute: Number.parseInt(lookup.minute, 10),
    second: Number.parseInt(lookup.second, 10),
    millisecond: Number.parseInt(lookup.fractionalSecond || '0', 10),
  };
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = getDateTimePartsInTimeZone(date, timeZone);
  const zonedUtcTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );

  return zonedUtcTimestamp - date.getTime();
}

function getZonedLocalInstant(
  dateInput: string,
  timeZone: string,
  options: { hour: number; minute: number; second: number; millisecond?: number }
) {
  const [year, month, day] = dateInput.split('-').map((value) => Number.parseInt(value, 10));
  const localTimestamp = Date.UTC(
    year,
    month - 1,
    day,
    options.hour,
    options.minute,
    options.second,
    options.millisecond ?? 0
  );
  const approximateUtcDate = new Date(localTimestamp);
  const offset = getTimeZoneOffsetMilliseconds(approximateUtcDate, timeZone);

  return new Date(localTimestamp - offset);
}

/**
 * Format date/time for London timezone display
 */
export function formatDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: LONDON_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  };

  return new Intl.DateTimeFormat('en-GB', defaultOptions).format(dateObj);
}

/**
 * Format time only for London timezone
 */
export function formatTime(date: Date | string): string {
  return formatDateTime(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format date only for London timezone
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Format a value for `<input type="date">` in London local date.
 */
export function formatDateInputValueInLondon(date: Date | string = new Date()): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

/**
 * Get the UTC ISO range that matches a calendar day in London local time.
 */
export function getLondonDayRange(dateInput: string): { start: string; end: string } {
  return {
    start: getZonedLocalInstant(dateInput, LONDON_TIMEZONE, {
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    }).toISOString(),
    end: getZonedLocalInstant(dateInput, LONDON_TIMEZONE, {
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    }).toISOString(),
  };
}

/**
 * Get current date/time in London timezone as ISO string
 */
export function nowInLondon(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: LONDON_TIMEZONE }).replace(' ', 'T') + 'Z';
}

/**
 * Check if a date is today in London timezone
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  const londonDate = new Intl.DateTimeFormat('en-CA', { 
    timeZone: LONDON_TIMEZONE 
  }).format(dateObj);
  
  const londonToday = new Intl.DateTimeFormat('en-CA', { 
    timeZone: LONDON_TIMEZONE 
  }).format(today);
  
  return londonDate === londonToday;
}
