import { Slide, GlobalSettings } from '../types';

/**
 * Returns the effective hour and minute considering time simulation
 */
export function getEffectiveTime(settings: GlobalSettings): {
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  formatted: string;
} {
  const now = new Date();
  let hour = now.getHours();
  let minute = now.getMinutes();
  const dayOfWeek = now.getDay();

  if (settings.timeSimulationMode) {
    hour = settings.simulatedHour ?? hour;
    minute = settings.simulatedMinute ?? minute;
  }

  const hh = hour.toString().padStart(2, '0');
  const mm = minute.toString().padStart(2, '0');

  return {
    hour,
    minute,
    dayOfWeek,
    formatted: `${hh}:${mm}`,
  };
}

/**
 * Parse "HH:mm" to decimal hours (e.g. "09:30" => 9.5)
 */
export function parseTimeToDecimal(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

/**
 * Checks if a specific time falls within a start-end range (supports overnight)
 */
export function isTimeInRange(currentDecimal: number, startDecimal: number, endDecimal: number): boolean {
  if (startDecimal <= endDecimal) {
    return currentDecimal >= startDecimal && currentDecimal < endDecimal;
  }
  // Overnight range (e.g. 20:30 to 02:00)
  return currentDecimal >= startDecimal || currentDecimal < endDecimal;
}

/**
 * Checks whether a slide is eligible to display right now based on its schedule
 */
export function isSlideActiveNow(slide: Slide, settings: GlobalSettings): boolean {
  if (!slide.active) return false;
  if (!slide.schedule?.enabled) return true;

  const { hour, minute, dayOfWeek } = getEffectiveTime(settings);
  const currentDecimal = hour + minute / 60;

  // Day of week check
  if (slide.schedule.daysOfWeek && slide.schedule.daysOfWeek.length > 0) {
    if (!slide.schedule.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
  }

  const slot = slide.schedule.timeSlot;

  switch (slot) {
    case 'all':
      return true;
    case 'morning':
      // 07:00 - 12:00
      return currentDecimal >= 7 && currentDecimal < 12;
    case 'lunch':
      // 12:00 - 16.5 (16:30)
      return currentDecimal >= 12 && currentDecimal < 16.5;
    case 'afternoon':
      // 16.5 (16:30) - 20.5 (20:30)
      return currentDecimal >= 16.5 && currentDecimal < 20.5;
    case 'evening':
      // 20.5 (20:30) - 2.0 (02:00 next day)
      return isTimeInRange(currentDecimal, 20.5, 2.0);
    case 'custom': {
      const start = parseTimeToDecimal(slide.schedule.customStart || '00:00');
      const end = parseTimeToDecimal(slide.schedule.customEnd || '23:59');
      return isTimeInRange(currentDecimal, start, end);
    }
    default:
      return true;
  }
}

/**
 * Human-readable schedule label
 */
export function getScheduleLabel(slide: Slide): string {
  if (!slide.schedule?.enabled) return 'Todo el día (Siempre)';
  switch (slide.schedule.timeSlot) {
    case 'all':
      return 'Todo el día';
    case 'morning':
      return 'Mañanas (07:00 - 12:00)';
    case 'lunch':
      return 'Mediodía (12:00 - 16:30)';
    case 'afternoon':
      return 'Tardes (16:30 - 20:30)';
    case 'evening':
      return 'Noches (20:30 - 02:00)';
    case 'custom':
      return `${slide.schedule.customStart || '00:00'} - ${slide.schedule.customEnd || '23:59'}`;
    default:
      return 'Todo el día';
  }
}
