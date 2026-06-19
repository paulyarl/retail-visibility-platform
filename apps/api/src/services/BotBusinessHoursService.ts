/**
 * Bot Business Hours Service
 *
 * Detects whether a tenant is currently within business hours
 * by reading from business_hours_list and business_hours_special_list.
 *
 * Used by the bot to determine after-hours mode and context-aware greetings.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface BusinessHoursResult {
  isOpen: boolean;
  timezone: string;
  nextOpenTime: string | null;
  reason: string;
}

interface BusinessPeriod {
  day: string;
  open: string;
  close: string;
}

class BotBusinessHoursService {
  private static instance: BotBusinessHoursService;

  private constructor() {}

  static getInstance(): BotBusinessHoursService {
    if (!BotBusinessHoursService.instance) {
      BotBusinessHoursService.instance = new BotBusinessHoursService();
    }
    return BotBusinessHoursService.instance;
  }

  /**
   * Check if the tenant is currently within business hours.
   * Checks special hours first, then regular weekly schedule.
   */
  async checkBusinessHours(tenantId: string): Promise<BusinessHoursResult> {
    try {
      const regular = await prisma.business_hours_list.findUnique({
        where: { tenant_id: tenantId },
      });

      if (!regular) {
        return { isOpen: true, timezone: 'America/New_York', nextOpenTime: null, reason: 'no_hours_set' };
      }

      const timezone = regular.timezone || 'America/New_York';
      const now = new Date();

      // Check special hours for today
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const special = await prisma.business_hours_special_list.findFirst({
        where: {
          tenant_id: tenantId,
          date: todayDate,
        },
      });

      if (special) {
        if (special.isClosed) {
          return { isOpen: false, timezone, nextOpenTime: null, reason: 'special_closed' };
        }
        if (special.open && special.close) {
          const isOpen = this.isWithinTimeWindow(now, special.open, special.close, timezone);
          return {
            isOpen,
            timezone,
            nextOpenTime: isOpen ? null : special.open,
            reason: isOpen ? 'special_open' : 'special_closed',
          };
        }
      }

      // Check regular weekly schedule
      const periods = (regular.periods as unknown as BusinessPeriod[]) || [];
      if (periods.length === 0) {
        return { isOpen: true, timezone, nextOpenTime: null, reason: 'no_schedule' };
      }

      const dayName = this.getDayName(now, timezone);
      const todayPeriods = periods.filter(p => p.day.toLowerCase() === dayName);

      if (todayPeriods.length === 0) {
        const nextDay = this.findNextOpenDay(periods, dayName);
        return {
          isOpen: false,
          timezone,
          nextOpenTime: nextDay ? `${nextDay.day} ${nextDay.open}` : null,
          reason: 'closed_today',
        };
      }

      for (const period of todayPeriods) {
        if (this.isWithinTimeWindow(now, period.open, period.close, timezone)) {
          return { isOpen: true, timezone, nextOpenTime: null, reason: 'open' };
        }
      }

      // Not currently open but has hours today
      const nextPeriod = todayPeriods.find(p => this.isAfterTime(now, p.open, timezone));
      return {
        isOpen: false,
        timezone,
        nextOpenTime: nextPeriod ? nextPeriod.open : null,
        reason: 'before_opening',
      };
    } catch (error) {
      logger.warn('[BotBusinessHours] Failed to check business hours', undefined, {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { isOpen: true, timezone: 'America/New_York', nextOpenTime: null, reason: 'error_default_open' };
    }
  }

  private getDayName(date: Date, timezone: string): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: timezone,
      });
      return formatter.format(date).toLowerCase();
    } catch {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      return days[date.getDay()];
    }
  }

  private isWithinTimeWindow(now: Date, openTime: string, closeTime: string, timezone: string): boolean {
    const currentStr = this.getCurrentTimeString(now, timezone);
    return currentStr >= openTime && currentStr < closeTime;
  }

  private isAfterTime(now: Date, openTime: string, timezone: string): boolean {
    const currentStr = this.getCurrentTimeString(now, timezone);
    return currentStr < openTime;
  }

  private getCurrentTimeString(now: Date, timezone: string): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      });
      return formatter.format(now);
    } catch {
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    }
  }

  private findNextOpenDay(periods: BusinessPeriod[], currentDay: string): BusinessPeriod | null {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentIdx = days.indexOf(currentDay);
    if (currentIdx === -1) return null;

    for (let i = 1; i <= 7; i++) {
      const dayIdx = (currentIdx + i) % 7;
      const dayName = days[dayIdx];
      const period = periods.find(p => p.day.toLowerCase() === dayName);
      if (period) return period;
    }
    return null;
  }
}

export default BotBusinessHoursService;
