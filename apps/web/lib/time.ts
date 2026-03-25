/**
 * Time utilities for Oasis Care application
 * Default timezone: Europe/London
 */

const LONDON_TIMEZONE = 'Europe/London';

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
  return formatDateTime(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
