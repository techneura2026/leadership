import { isReminderDue, localDate } from '../../src/assessment/shared/reminder-schedule';

describe('reminder schedule (reminderDays = days before endDate)', () => {
  const end = new Date('2027-06-30T18:29:59Z'); // 23:59:59 on 30 June in Colombo (UTC+05:30)

  it('is due when today is endDate − 3 and reminderDays includes 3', () => {
    expect(isReminderDue(end, [3], new Date('2027-06-27T04:00:00Z'))).toBe(true);
  });

  it('is not due on other days', () => {
    expect(isReminderDue(end, [3], new Date('2027-06-26T04:00:00Z'))).toBe(false);
    expect(isReminderDue(end, [3], new Date('2027-06-28T04:00:00Z'))).toBe(false);
  });

  it('uses the Colombo calendar date, not UTC', () => {
    // 23:30 UTC on 26 June is already 27 June in Colombo
    expect(localDate(new Date('2027-06-26T23:30:00Z'))).toBe('2027-06-27');
    expect(isReminderDue(end, [3], new Date('2027-06-26T23:30:00Z'))).toBe(true);
  });

  it('supports several reminder days and the end day itself (0)', () => {
    expect(isReminderDue(end, [7, 1, 0], new Date('2027-06-30T03:00:00Z'))).toBe(true);
    expect(isReminderDue(end, [7, 1, 0], new Date('2027-06-23T03:00:00Z'))).toBe(true);
  });

  it('is never due with no reminderDays, no end date, or after the end date', () => {
    expect(isReminderDue(end, [], new Date('2027-06-27T04:00:00Z'))).toBe(false);
    expect(isReminderDue(null, [3], new Date('2027-06-27T04:00:00Z'))).toBe(false);
    expect(isReminderDue(end, [-1], new Date('2027-07-01T04:00:00Z'))).toBe(false);
  });
});
