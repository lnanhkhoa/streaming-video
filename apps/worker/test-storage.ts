#!/usr/bin/env tsx
/**
 * Test script for MinIO Storage Service
 *
 * Usage:
 *   bun run test:storage
 *
 * Prerequisites:
 *   - MinIO running on localhost:9000
 *   - docker-compose -f docker-compose.dev.yml up -d minio
 */

import { storageService } from './src/services/storage'
import fs from 'node:fs/promises'
import path from 'node:path'

const TEST_FILE = '/tmp/test-upload.txt'
const TEST_KEY = 'test/test-upload.txt'
const DOWNLOAD_PATH = '/tmp/test-download.txt'

async function createTestFile() {
  const content = `Test file created at ${new Date().toISOString()}\n`
  await fs.writeFile(TEST_FILE, content, 'utf-8')
  console.log(`✅ Created test file: ${TEST_FILE}`)
}

async function testUpload() {
  console.log('\n📤 Testing upload...')
  await storageService.uploadFile(TEST_FILE, TEST_KEY)
  console.log('✅ Upload successful')
}

async function testFileExists() {
  console.log('\n🔍 Testing file existence...')
  const exists = await storageService.fileExists(TEST_KEY)
  if (!exists) {
    throw new Error('File should exist but does not')
  }
  console.log('✅ File exists check passed')
}

async function testDownload() {
  console.log('\n📥 Testing download...')
  await storageService.downloadFile(TEST_KEY, DOWNLOAD_PATH)

  const content = await fs.readFile(DOWNLOAD_PATH, 'utf-8')
  console.log(`✅ Downloaded file content: ${content.trim()}`)
}

async function testUploadDirectory() {
  console.log('\n📂 Testing directory upload...')

  const testDir = '/tmp/test-dir'
  await fs.mkdir(testDir, { recursive: true })
  await fs.writeFile(path.join(testDir, 'file1.txt'), 'File 1', 'utf-8')
  await fs.writeFile(path.join(testDir, 'file2.txt'), 'File 2', 'utf-8')

  const subDir = path.join(testDir, 'subdir')
  await fs.mkdir(subDir, { recursive: true })
  await fs.writeFile(path.join(subDir, 'file3.txt'), 'File 3', 'utf-8')

  const keys = await storageService.uploadDirectory(testDir, 'test-dir')
  console.log(`✅ Uploaded ${keys.length} files:`)
  keys.forEach((key) => console.log(`   - ${key}`))

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true })
}

async function testDelete() {
  console.log('\n🗑️  Testing delete...')
  await storageService.deleteFiles('test')
  console.log('✅ Delete successful')

  const exists = await storageService.fileExists(TEST_KEY)
  if (exists) {
    throw new Error('File should not exist after deletion')
  }
  console.log('✅ File deleted verification passed')
}

async function cleanup() {
  console.log('\n🧹 Cleaning up local files...')
  await fs.rm(TEST_FILE, { force: true })
  await fs.rm(DOWNLOAD_PATH, { force: true })
  console.log('✅ Cleanup complete')
}

async function main() {
  console.log('🗄️  MinIO Storage Service Test\n')

  try {
    // Wait for storage service to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await createTestFile()
    await testUpload()
    await testFileExists()
    await testDownload()
    await testUploadDirectory()
    await testDelete()

    console.log('\n✅ All storage tests passed!')
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    await cleanup()
  }
}

main()
