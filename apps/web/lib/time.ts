import {
  formatInOrganizationTimezone,
  organizationCalendarDayUtcRange,
  organizationCalendarMonthUtcRange,
  organizationDateKey as dateKeyInOrganizationTimezone,
  organizationDayUtcRange,
  organizationWallClock,
  organizationWeekUtcRange,
  resolveOrganizationTimezone,
  resolveOrganizationWallClock,
} from '@oasis/time';

type OrganizationDayRange = { start: string; end: string };

/**
 * Format date/time for London timezone display
 */
export function formatDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  };

  return formatInOrganizationTimezone(date, defaultOptions);
}

/**
 * Format time only for London timezone
 */
export function formatTime(date: Date | string): string {
  return formatInOrganizationTimezone(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format date only for London timezone
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatInOrganizationTimezone(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatOrganizationLongDate(date: Date | string): string {
  return formatInOrganizationTimezone(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getOrganizationDayUtcRange(now: Date = new Date()): OrganizationDayRange {
  const range = organizationDayUtcRange(now);
  return {
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  };
}

// Compatibility aliases for existing page imports. The implementation resolves
// the organization timezone centrally and is not tied to the function name.
export const formatLondonLongDate = formatOrganizationLongDate;
export const getLondonDayUtcRange = getOrganizationDayUtcRange;

export function getOrganizationDateUtcRange(dateKey: string): OrganizationDayRange {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new RangeError('Enter a valid organization calendar date');
  const range = organizationCalendarDayUtcRange({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
  return { start: range.start.toISOString(), end: range.end.toISOString() };
}

export function getOrganizationWeekUtcRange(now: Date = new Date()): OrganizationDayRange {
  const range = organizationWeekUtcRange(now);
  return { start: range.start.toISOString(), end: range.end.toISOString() };
}

export function getOrganizationMonthUtcRange(
  year: number,
  month: number,
): OrganizationDayRange {
  const range = organizationCalendarMonthUtcRange(year, month);
  return { start: range.start.toISOString(), end: range.end.toISOString() };
}

/**
 * Get current date/time in London timezone as ISO string
 */
export function nowInLondon(): string {
  return new Date().toISOString();
}

/**
 * Check if a date is today in London timezone
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return organizationDateKey(dateObj) === organizationDateKey(new Date());
}

export const ORGANIZATION_TIMEZONE = resolveOrganizationTimezone();

export function organizationDateKey(date: Date | string = new Date()): string {
  const instant = typeof date === 'string' ? new Date(date) : date;
  return dateKeyInOrganizationTimezone(instant);
}

export function formatOrganizationDateTimeInput(date: Date | string): string {
  const instant = typeof date === 'string' ? new Date(date) : date;
  const wallClock = organizationWallClock(instant);
  return `${String(wallClock.year).padStart(4, '0')}-${String(wallClock.month).padStart(2, '0')}-${String(wallClock.day).padStart(2, '0')}T${String(wallClock.hour).padStart(2, '0')}:${String(wallClock.minute).padStart(2, '0')}`;
}

export function organizationDateTimeInputToIso(value: string): string {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new RangeError('Enter a valid organization date and time');
  const resolution = resolveOrganizationWallClock({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  });
  if (resolution.kind !== 'unique') {
    throw new RangeError(
      resolution.kind === 'ambiguous'
        ? 'This organization time occurs twice because the clocks change. Choose an unambiguous time.'
        : 'This organization time does not exist because the clocks change. Choose another time.',
    );
  }
  return resolution.instant.toISOString();
}
