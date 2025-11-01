/**
 * Worker Metrics Collection
 *
 * Tracks performance metrics for monitoring and optimization:
 * - Jobs processed/failed
 * - Processing times
 * - Memory usage
 * - Success rates
 */

interface JobMetrics {
  startTime: number
  videoId: string
}

export class WorkerMetrics {
  private activeJobs = new Map<string, JobMetrics>()
  private jobsProcessed = 0
  private jobsFailed = 0
  private totalProcessingTime = 0
  private peakMemoryUsage = 0
  private startTime = Date.now()

  /**
   * Record job start
   */
  recordJobStart(jobId: string, videoId: string): void {
    this.activeJobs.set(jobId, {
      startTime: Date.now(),
      videoId
    })
  }

  /**
   * Record job completion
   */
  recordJobComplete(jobId: string, success: boolean): void {
    const job = this.activeJobs.get(jobId)
    if (!job) return

    const duration = Date.now() - job.startTime
    this.totalProcessingTime += duration

    if (success) {
      this.jobsProcessed++
      console.log(`✅ Job ${jobId} completed in ${(duration / 1000).toFixed(1)}s`)
    } else {
      this.jobsFailed++
      console.log(`❌ Job ${jobId} failed after ${(duration / 1000).toFixed(1)}s`)
    }

    this.activeJobs.delete(jobId)

    // Log stats every 10 jobs
    if ((this.jobsProcessed + this.jobsFailed) % 10 === 0) {
      console.log('📊 Worker Stats:', this.getStats())
    }
  }

  /**
   * Update memory usage
   */
  updateMemoryUsage(): void {
    const usage = process.memoryUsage()
    const rss = usage.rss

    if (rss > this.peakMemoryUsage) {
      this.peakMemoryUsage = rss
    }

    // Warn if > 1.5GB
    if (rss > 1.5 * 1024 * 1024 * 1024) {
      console.warn('⚠️  High memory usage:', {
        rss: `${Math.round(rss / 1024 / 1024)}MB`,
        heap: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`
      })
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    const totalJobs = this.jobsProcessed + this.jobsFailed
    const successRate = totalJobs > 0 ? (this.jobsProcessed / totalJobs) * 100 : 0
    const avgProcessingTime = totalJobs > 0 ? this.totalProcessingTime / totalJobs : 0
    const uptime = Date.now() - this.startTime

    return {
      uptime: Math.round(uptime / 1000), // seconds
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
      totalJobs,
      successRate: successRate.toFixed(1) + '%',
      averageProcessingTime: (avgProcessingTime / 1000).toFixed(1) + 's',
      peakMemoryUsage: Math.round(this.peakMemoryUsage / 1024 / 1024) + 'MB',
      activeJobs: this.activeJobs.size
    }
  }

  /**
   * Get health status
   */
  getHealth() {
    const memory = process.memoryUsage()
    const totalJobs = this.jobsProcessed + this.jobsFailed
    const successRate = totalJobs > 0 ? (this.jobsProcessed / totalJobs) * 100 : 100

    return {
      status: successRate >= 80 ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
        heap: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
        external: Math.round(memory.external / 1024 / 1024) + 'MB'
      },
      metrics: this.getStats()
    }
  }
}

export const metrics = new WorkerMetrics()

// Monitor memory every minute
setInterval(() => {
  metrics.updateMemoryUsage()
}, 60000)
