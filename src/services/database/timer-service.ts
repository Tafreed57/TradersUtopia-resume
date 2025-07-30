import { BaseDatabaseService } from './base-service';
import { Timer } from '@prisma/client';
import { apiLogger } from '@/lib/enhanced-logger';

interface CreateTimerData {
  duration: number;
  message: string;
  priceMessage: string;
}

interface UpdateTimerData {
  duration?: number;
  message?: string;
  priceMessage?: string;
  startTime?: Date;
}

interface TimerWithCalculations extends Timer {
  remainingHours: number;
  isExpired: boolean;
}

/**
 * TimerService
 *
 * Centralized timer management operations including:
 * - Timer retrieval with automatic reset when expired
 * - Timer settings updates with admin verification
 * - Remaining time calculations
 * - Timer state management
 */
export class TimerService extends BaseDatabaseService {
  /**
   * Get the current timer with automatic reset if expired
   * This is the main method that should be used for any timer retrieval
   */
  async getTimer(): Promise<TimerWithCalculations> {
    let timer = await this.findOrCreateActiveTimer();

    // Check if timer is expired and reset if needed
    const timerWithCalculations = this.calculateTimerStatus(timer);
    if (timerWithCalculations.isExpired) {
      timer = await this.resetTimer(timer.id);
      return this.calculateTimerStatus(timer);
    }

    return timerWithCalculations;
  }

  /**
   * Update timer settings (admin only operation)
   */
  async updateTimerSettings(
    timerData: CreateTimerData,
    adminUserId: string
  ): Promise<TimerWithCalculations> {
    // Get the current active timer or create one
    const currentTimer = await this.findOrCreateActiveTimer();

    // Update the timer settings and reset the start time
    const updatedTimer = await this.prisma.timer.update({
      where: { id: currentTimer.id },
      data: {
        startTime: new Date(), // Reset timer when settings change
        duration: timerData.duration,
        message: timerData.message,
        priceMessage: timerData.priceMessage,
      },
    });

    apiLogger.databaseOperation('timer_settings_updated', true, {
      timerId: updatedTimer.id.substring(0, 8) + '***',
      adminUserId: adminUserId.substring(0, 8) + '***',
      duration: updatedTimer.duration,
      message: timerData.message.substring(0, 20) + '...',
      priceMessage: timerData.priceMessage.substring(0, 20) + '...',
    });

    return this.calculateTimerStatus(updatedTimer);
  }

  /**
   * Find existing active timer or create a default one
   */
  private async findOrCreateActiveTimer(): Promise<Timer> {
    let timer = await this.prisma.timer.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // If no active timer exists, create a default one
    if (!timer) {
      timer = await this.prisma.timer.create({
        data: {
          startTime: new Date(),
          duration: 72, // 72 hours default
          message: 'Lock in current pricing before increase',
          priceMessage: 'Next price increase: $199/month',
          isActive: true,
        },
      });

      apiLogger.databaseOperation('default_timer_created', true, {
        timerId: timer.id.substring(0, 8) + '***',
        duration: timer.duration,
      });
    }

    return timer;
  }

  /**
   * Reset timer by updating its start time
   */
  private async resetTimer(timerId: string): Promise<Timer> {
    const timer = await this.prisma.timer.findUnique({
      where: { id: timerId },
    });

    if (!timer) {
      throw new Error('Timer not found');
    }

    const updatedTimer = await this.prisma.timer.update({
      where: { id: timerId },
      data: {
        startTime: new Date(),
      },
    });

    apiLogger.databaseOperation('timer_reset', true, {
      timerId: timerId.substring(0, 8) + '***',
      previousStartTime: timer.startTime.toISOString(),
      newStartTime: updatedTimer.startTime.toISOString(),
    });

    return updatedTimer;
  }

  /**
   * Calculate timer status with remaining hours and expiry
   */
  private calculateTimerStatus(timer: Timer): TimerWithCalculations {
    const currentTime = Date.now();
    const startTime = timer.startTime.getTime();
    const elapsedHours = (currentTime - startTime) / (1000 * 60 * 60);
    const remainingHours = Math.max(0, timer.duration - elapsedHours);
    const isExpired = remainingHours <= 0;

    return {
      ...timer,
      remainingHours,
      isExpired,
    };
  }
}
