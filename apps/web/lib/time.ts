/**
 * Time utilities for Oasis Care application
 * Default timezone: Europe/London
 */

const LONDON_TIMEZONE = 'Europe/London';

type LondonDayRange = { start: string; end: string };

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
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dateObj);
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

export function formatLondonLongDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateObj);
}

export function getLondonDayUtcRange(now: Date = new Date()): LondonDayRange {
  const current = londonDateParts(now);
  const nextCalendarDay = new Date(
    Date.UTC(current.year, current.month - 1, current.day + 1),
  );
  return {
    start: londonMidnightUtc(current.year, current.month, current.day).toISOString(),
    end: londonMidnightUtc(
      nextCalendarDay.getUTCFullYear(),
      nextCalendarDay.getUTCMonth() + 1,
      nextCalendarDay.getUTCDate(),
    ).toISOString(),
  };
}

function londonDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function londonMidnightUtc(year: number, month: number, day: number): Date {
  const wallClockUtc = Date.UTC(year, month - 1, day);
  let utc = wallClockUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: LONDON_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utc));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const representedAsUtc = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    );
    utc = wallClockUtc - (representedAsUtc - utc);
  }
  return new Date(utc);
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
