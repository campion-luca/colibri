import { describe, expect, it } from 'vitest';
import { formatLeft, msToMidnight, nowIn, startOfDayTs, timeOf } from '../clock.ts';
import { addDays, addMonths, daysInMonth, ddmm, diffDays, dowOf, toMin } from '../date.ts';
import { deterministicUuid, penaltyId } from '../ids.ts';

describe('ambiente di test', () => {
  it('gira con un fuso diverso da Roma', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Los_Angeles');
  });
});

describe('date (giorni di calendario)', () => {
  it('somma giorni a cavallo di mese, anno e ora legale', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('conta i giorni tra due date', () => {
    expect(diffDays('2026-11-09', '2026-11-10')).toBe(1);
    expect(diffDays('2026-11-10', '2026-11-09')).toBe(-1);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('giorno della settimana da lunedì (1) a domenica (7)', () => {
    expect(dowOf('2026-11-09')).toBe(1);
    expect(dowOf('2026-11-10')).toBe(2);
    expect(dowOf('2026-11-15')).toBe(7);
  });

  it('giorni nel mese, anni bisestili compresi', () => {
    expect(daysInMonth('2026-02-10')).toBe(28);
    expect(daysInMonth('2028-02-10')).toBe(29);
    expect(daysInMonth('2026-04-01')).toBe(30);
    expect(daysInMonth('2026-12-01')).toBe(31);
  });

  it('mesi, orari, etichette', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(toMin('07:30')).toBe(450);
    expect(toMin('23:59')).toBe(1439);
    expect(ddmm('2026-11-09')).toBe('09/11');
  });
});

describe('clock (Europe/Rome)', () => {
  it('il giorno e il minuto sono quelli di Roma, non del dispositivo', () => {
    // inverno, UTC+1: 23:30Z è già il giorno dopo a Roma
    expect(nowIn(new Date('2026-11-10T23:30:00Z'))).toMatchObject({
      day: '2026-11-11',
      minute: 30,
    });
    // estate, UTC+2
    expect(nowIn(new Date('2026-07-01T22:30:00Z'))).toMatchObject({
      day: '2026-07-02',
      minute: 30,
    });
    expect(nowIn(new Date('2026-07-01T09:15:00Z'))).toMatchObject({
      day: '2026-07-01',
      minute: 675,
    });
  });

  it('tempo alla mezzanotte nei giorni del cambio d’ora', () => {
    const h = 3_600_000;
    expect(msToMidnight(new Date(startOfDayTs('2026-03-29')))).toBe(23 * h);
    expect(msToMidnight(new Date(startOfDayTs('2026-10-25')))).toBe(25 * h);
    expect(msToMidnight(new Date(startOfDayTs('2026-11-10')))).toBe(24 * h);
    expect(msToMidnight(new Date('2026-11-10T21:00:00Z'))).toBe(2 * h);
  });

  it('formatta il tempo rimasto e l’ora', () => {
    expect(formatLeft(3 * 3_600_000 + 7 * 60_000)).toBe('3h 07m');
    expect(formatLeft(-5)).toBe('0h 00m');
    expect(timeOf(Date.parse('2026-11-10T08:05:00Z'))).toBe('09:05');
  });
});

describe('id deterministici', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('stesso input → stesso UUID v8 valido', () => {
    const a = penaltyId('u', '2026-11-09', 'item', 'mezzanotte');
    expect(a).toMatch(UUID);
    expect(penaltyId('u', '2026-11-09', 'item', 'mezzanotte')).toBe(a);
  });

  it('cambia con utente, giorno, elemento o motivo', () => {
    const ids = new Set([
      penaltyId('u', '2026-11-09', 'item', 'mezzanotte'),
      penaltyId('v', '2026-11-09', 'item', 'mezzanotte'),
      penaltyId('u', '2026-11-10', 'item', 'mezzanotte'),
      penaltyId('u', '2026-11-09', 'other', 'mezzanotte'),
      penaltyId('u', '2026-11-09', 'item', 'finestra'),
    ]);
    expect(ids.size).toBe(5);
    expect(deterministicUuid('a', 'bc')).not.toBe(deterministicUuid('ab', 'c'));
  });
});
