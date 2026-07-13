export const UK_PILOT_ORGANIZATION_TIMEZONE = 'Europe/London';

export interface OrganizationTimezoneResolver {
  resolve(organizationId?: string): string;
}

export interface OrganizationCalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface OrganizationWallClock extends OrganizationCalendarDate {
  hour: number;
  minute: number;
}

export interface OrganizationInclusiveCalendarPeriod {
  start: OrganizationCalendarDate;
  end: OrganizationCalendarDate;
}

export type WallClockResolution =
  | { kind: 'unique'; instant: Date }
  | { kind: 'ambiguous'; instants: [Date, Date] }
  | { kind: 'nonexistent' };

class PilotOrganizationTimezoneResolver implements OrganizationTimezoneResolver {
  resolve(_organizationId?: string): string {
    return UK_PILOT_ORGANIZATION_TIMEZONE;
  }
}

export const organizationTimezoneResolver: OrganizationTimezoneResolver =
  new PilotOrganizationTimezoneResolver();

const validTimezones = new Set<string>();
const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();

export function assertIanaTimezone(timezone: string): string {
  const normalized = String(timezone || '').trim();
  if (validTimezones.has(normalized)) return normalized;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: normalized }).format(0);
  } catch {
    throw new RangeError('Organization timezone must be a valid IANA timezone');
  }
  validTimezones.add(normalized);
  return normalized;
}

export function resolveOrganizationTimezone(
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): string {
  return assertIanaTimezone(resolver.resolve(organizationId));
}

function partNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = Number(parts.find((part) => part.type === type)?.value);
  if (!Number.isInteger(value)) {
    throw new RangeError(`Timezone formatter did not return a numeric ${type}`);
  }
  return value;
}

function zonedParts(instant: Date, timezone: string): OrganizationWallClock & { second: number } {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Instant must be a valid date');
  }
  const normalizedTimezone = assertIanaTimezone(timezone);
  let formatter = wallClockFormatters.get(normalizedTimezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: normalizedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    wallClockFormatters.set(normalizedTimezone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  return {
    year: partNumber(parts, 'year'),
    month: partNumber(parts, 'month'),
    day: partNumber(parts, 'day'),
    hour: partNumber(parts, 'hour'),
    minute: partNumber(parts, 'minute'),
    second: partNumber(parts, 'second'),
  };
}

export function organizationCalendarDate(
  instant: Date,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): OrganizationCalendarDate {
  const timezone = resolveOrganizationTimezone(organizationId, resolver);
  const { year, month, day } = zonedParts(instant, timezone);
  return { year, month, day };
}

export function organizationWallClock(
  instant: Date,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): OrganizationWallClock {
  const timezone = resolveOrganizationTimezone(organizationId, resolver);
  const { year, month, day, hour, minute } = zonedParts(instant, timezone);
  return { year, month, day, hour, minute };
}

export function organizationDateKey(
  instant: Date,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): string {
  const { year, month, day } = organizationCalendarDate(instant, organizationId, resolver);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addCalendarDays(
  date: OrganizationCalendarDate,
  days: number,
): OrganizationCalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function parseOrganizationDateKey(value: string): OrganizationCalendarDate {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new RangeError('Organization calendar date must use YYYY-MM-DD');
  }
  const parsed = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const normalized = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  if (
    normalized.getUTCFullYear() !== parsed.year ||
    normalized.getUTCMonth() + 1 !== parsed.month ||
    normalized.getUTCDate() !== parsed.day
  ) {
    throw new RangeError('Organization calendar date must be valid');
  }
  return parsed;
}

export function organizationCalendarDateToUtcStoredDate(
  date: OrganizationCalendarDate,
): Date {
  const key = `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  const validated = parseOrganizationDateKey(key);
  return new Date(Date.UTC(validated.year, validated.month - 1, validated.day));
}

export function utcStoredDateToCalendarDate(date: Date): OrganizationCalendarDate {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Stored date must be valid');
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function sameWallClock(
  candidate: OrganizationWallClock & { second: number },
  requested: OrganizationWallClock,
): boolean {
  return (
    candidate.year === requested.year &&
    candidate.month === requested.month &&
    candidate.day === requested.day &&
    candidate.hour === requested.hour &&
    candidate.minute === requested.minute &&
    candidate.second === 0
  );
}

export function resolveOrganizationWallClock(
  wallClock: OrganizationWallClock,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): WallClockResolution {
  const timezone = resolveOrganizationTimezone(organizationId, resolver);
  const nominalUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    0,
    0,
  );
  const matches: Date[] = [];
  const possibleOffsets = new Set<number>();

  // Sample the surrounding three days to discover both sides of a nearby
  // timezone transition without assuming whole-hour offsets.
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = new Date(nominalUtc + hours * 60 * 60_000);
    const parts = zonedParts(probe, timezone);
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    possibleOffsets.add(representedUtc - probe.getTime());
  }

  for (const offset of Array.from(possibleOffsets)) {
    const candidate = new Date(nominalUtc - offset);
    if (sameWallClock(zonedParts(candidate, timezone), wallClock)) {
      matches.push(candidate);
    }
  }

  if (matches.length === 0) return { kind: 'nonexistent' };
  matches.sort((left, right) => left.getTime() - right.getTime());
  if (matches.length === 1) return { kind: 'unique', instant: matches[0] };
  return { kind: 'ambiguous', instants: [matches[0], matches[1]] };
}

export function organizationDayUtcRange(
  instant: Date,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): { start: Date; end: Date } {
  const current = organizationCalendarDate(instant, organizationId, resolver);
  return organizationCalendarDayUtcRange(current, organizationId, resolver);
}

export function organizationCalendarDayUtcRange(
  current: OrganizationCalendarDate,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): { start: Date; end: Date } {
  const next = addCalendarDays(current, 1);
  const start = resolveOrganizationWallClock(
    { ...current, hour: 0, minute: 0 },
    organizationId,
    resolver,
  );
  const end = resolveOrganizationWallClock(
    { ...next, hour: 0, minute: 0 },
    organizationId,
    resolver,
  );
  if (start.kind !== 'unique' || end.kind !== 'unique') {
    throw new RangeError('Organization calendar midnight is not uniquely resolvable');
  }
  return { start: start.instant, end: end.instant };
}

export function organizationCalendarMonthUtcRange(
  year: number,
  month: number,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): { start: Date; end: Date } {
  const nextMonth = new Date(Date.UTC(year, month, 1));
  return organizationCalendarRangeUtc(
    { year, month, day: 1 },
    {
      year: nextMonth.getUTCFullYear(),
      month: nextMonth.getUTCMonth() + 1,
      day: 1,
    },
    organizationId,
    resolver,
  );
}

export function organizationWeekCalendarPeriod(
  instant: Date,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): OrganizationInclusiveCalendarPeriod {
  // Calendar-week views retain the application's established Sunday start.
  const current = organizationCalendarDate(instant, organizationId, resolver);
  const dayOfWeek = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
  const weekStart = addCalendarDays(current, -dayOfWeek);
  return { start: weekStart, end: addCalendarDays(weekStart, 6) };
}

export function organizationWeekUtcRange(
  instant: Date,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): { start: Date; end: Date } {
  const period = organizationWeekCalendarPeriod(instant, organizationId, resolver);
  return organizationCalendarRangeUtc(
    period.start,
    addCalendarDays(period.end, 1),
    organizationId,
    resolver,
  );
}

/**
 * Return the most recently completed Friday-to-Friday reporting window.
 * The end is exclusive, so the included organization calendar days are
 * Friday through Thursday. This is deliberately separate from calendar-week
 * views, which use Sunday through Saturday.
 */
export function organizationCompletedReportingPeriod(
  instant: Date,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): OrganizationInclusiveCalendarPeriod {
  const current = organizationCalendarDate(instant, organizationId, resolver);
  const dayOfWeek = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
  const daysSinceFriday = (dayOfWeek - 5 + 7) % 7;
  const completedPeriodEnd = addCalendarDays(current, -daysSinceFriday);
  return {
    start: addCalendarDays(completedPeriodEnd, -7),
    end: addCalendarDays(completedPeriodEnd, -1),
  };
}

export function organizationCompletedReportingPeriodUtcRange(
  instant: Date,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): { start: Date; end: Date } {
  const period = organizationCompletedReportingPeriod(instant, organizationId, resolver);
  return organizationCalendarRangeUtc(
    period.start,
    addCalendarDays(period.end, 1),
    organizationId,
    resolver,
  );
}

export function organizationCalendarRangeUtc(
  startDate: OrganizationCalendarDate,
  endDateExclusive: OrganizationCalendarDate,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): { start: Date; end: Date } {
  const start = resolveOrganizationWallClock(
    { ...startDate, hour: 0, minute: 0 },
    organizationId,
    resolver,
  );
  const end = resolveOrganizationWallClock(
    { ...endDateExclusive, hour: 0, minute: 0 },
    organizationId,
    resolver,
  );
  if (start.kind !== 'unique' || end.kind !== 'unique') {
    throw new RangeError('Organization calendar boundary is not uniquely resolvable');
  }
  return { start: start.instant, end: end.instant };
}

export function formatInOrganizationTimezone(
  instant: Date | string,
  options: Intl.DateTimeFormatOptions,
  organizationId?: string,
  resolver: OrganizationTimezoneResolver = organizationTimezoneResolver,
): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Instant must be a valid date');
  }
  return new Intl.DateTimeFormat('en-GB', {
    ...options,
    timeZone: resolveOrganizationTimezone(organizationId, resolver),
  }).format(date);
}
