#!/usr/bin/env tsx
/**
 * Phase 5: Service Health Check & Verification
 *
 * Tests all infrastructure services:
 * - PostgreSQL (Database)
 * - Redis (Cache)
 * - MinIO (Storage) - via worker service
 * - RabbitMQ (Queue)
 *
 * Usage:
 *   bun run test:services
 *
 * Prerequisites:
 *   docker-compose -f docker-compose.dev.yml up -d
 */

import { prisma } from '@repo/database'
import { cacheService } from './src/services/cache.service'
import { Client } from 'minio'
import amqp from 'amqplib'

interface TestResult {
  service: string
  status: 'pass' | 'fail'
  duration: number
  details?: string
  error?: string
}

const results: TestResult[] = []

async function testService(name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now()
  console.log(`\n▶️  Testing ${name}...`)

  try {
    const details = await fn()
    const duration = Date.now() - start
    results.push({ service: name, status: 'pass', duration, details })
    console.log(`✅ ${name} (${duration}ms)`)
    if (details) console.log(`   ${details}`)
  } catch (error) {
    const duration = Date.now() - start
    const errorMsg = error instanceof Error ? error.message : String(error)
    results.push({ service: name, status: 'fail', duration, error: errorMsg })
    console.error(`❌ ${name} failed: ${errorMsg}`)
  }
}

async function testPostgreSQL(): Promise<string> {
  await prisma.$connect()
  const result = await prisma.$queryRaw<Array<{ test: number }>>`SELECT 1 as test`
  if (!result || result[0]?.test !== 1) throw new Error('Query failed')
  return 'Connection and queries working'
}

async function testRedis(): Promise<string> {
  const testKey = 'health-check-test'
  const testValue = { timestamp: new Date().toISOString() }

  // Test set
  await cacheService.set(testKey, testValue, 60)

  // Test get
  const retrieved = await cacheService.get<typeof testValue>(testKey)
  if (!retrieved) throw new Error('Failed to retrieve value')

  // Test exists
  const exists = await cacheService.exists(testKey)
  if (!exists) throw new Error('Key should exist')

  // Test delete
  await cacheService.del(testKey)

  return 'Set, get, exists, delete all working'
}

async function testMinIO(): Promise<string> {
  const client = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'password'
  })

  // Test connection by listing buckets
  const buckets = await client.listBuckets()

  return `Connected, found ${buckets.length} bucket(s)`
}

async function testRabbitMQ(): Promise<string> {
  const url = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672'
  const connection = await amqp.connect(url)
  const channel = await connection.createChannel()

  // Test queue assertion
  await channel.assertQueue('video-transcode', { durable: true })

  await channel.close()
  await (connection as any).close()

  return 'Connection and queue assertion working'
}

function printResults() {
  console.log('\n' + '='.repeat(70))
  console.log('📊 Phase 5: Service Health Check Results')
  console.log('='.repeat(70))

  let totalDuration = 0
  let passed = 0
  let failed = 0

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : '❌'
    const duration = `${result.duration}ms`
    console.log(`${icon} ${result.service.padEnd(35)} ${duration.padStart(10)}`)
    if (result.details) {
      console.log(`   ${result.details}`)
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    totalDuration += result.duration
    if (result.status === 'pass') passed++
    else failed++
  }

  console.log('='.repeat(70))
  console.log(`Total: ${results.length} services tested`)
  console.log(`Passed: ${passed} | Failed: ${failed} | Duration: ${totalDuration}ms`)
  console.log('='.repeat(70))

  if (failed > 0) {
    console.log('\n⚠️  Some services failed. Troubleshooting:')
    console.log('   1. Check services are running:')
    console.log('      docker-compose -f docker-compose.dev.yml ps')
    console.log('   2. Check service logs:')
    console.log('      docker-compose -f docker-compose.dev.yml logs [service]')
    console.log('   3. Restart services:')
    console.log('      docker-compose -f docker-compose.dev.yml restart')
  } else {
    console.log('\n✅ All Phase 5 services are healthy and ready!')
    console.log('\nServices verified:')
    console.log('  • PostgreSQL - Database for video metadata')
    console.log('  • Redis - Caching layer for API performance')
    console.log('  • MinIO - Object storage for video files')
    console.log('  • RabbitMQ - Message queue for async job processing')
  }
}

async function main() {
  console.log('🏥 Phase 5: Infrastructure Service Health Check\n')

  try {
    await testService('PostgreSQL (Database)', testPostgreSQL)
    await testService('Redis (Cache)', testRedis)
    await testService('MinIO (Storage)', testMinIO)
    await testService('RabbitMQ (Queue)', testRabbitMQ)
  } catch (error) {
    console.error('\n❌ Unexpected error:', error)
    process.exitCode = 1
  } finally {
    printResults()
    await prisma.$disconnect()
  }
}

main()
