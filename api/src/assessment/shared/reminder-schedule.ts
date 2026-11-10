/**
 * Automatic reminders. `AssessmentConfig.reminderDays` means "days before endDate" (0 = the end
 * day itself), evaluated on the calendar of the organisations' time zone.
 */
export const REMINDER_TIME_ZONE = 'Asia/Colombo';

/** YYYY-MM-DD of `date` in the given time zone. */
export function localDate(date: Date, tz = REMINDER_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const dayNumber = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);

export function isReminderDue(
  endDate: Date | null | undefined,
  reminderDays: number[] | null | undefined,
  today: Date,
  tz = REMINDER_TIME_ZONE,
): boolean {
  if (!endDate || !reminderDays?.length) return false;
  const daysBefore = dayNumber(localDate(endDate, tz)) - dayNumber(localDate(today, tz));
  return daysBefore >= 0 && reminderDays.includes(daysBefore);
}
