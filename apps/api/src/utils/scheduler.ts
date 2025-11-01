import cron from 'node-cron'
import { analyticsService } from '../services/analytics.service'

export function initializeScheduler() {
  // Reset daily views at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    console.log('🕐 Running daily views reset...')
    try {
      await analyticsService.resetDailyViews()
    } catch (error) {
      console.error('Daily reset failed:', error)
    }
  })

  // Reset monthly views at midnight on 1st of month UTC
  cron.schedule('0 0 1 * *', async () => {
    console.log('🕐 Running monthly views reset...')
    try {
      await analyticsService.resetMonthlyViews()
    } catch (error) {
      console.error('Monthly reset failed:', error)
    }
  })

  console.log('✅ Analytics scheduler initialized')
}
