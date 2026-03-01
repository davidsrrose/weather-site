import { chromium, devices } from 'playwright'

const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--')
const targetUrl = rawArgs[0] ?? 'http://localhost:5173'
const deviceName = process.env.PLAYWRIGHT_DEVICE ?? 'iPhone 13'
const deviceProfile = devices[deviceName]

if (!deviceProfile) {
  const availableDevices = Object.keys(devices).join(', ')
  console.error(`Unknown Playwright device "${deviceName}". Available devices: ${availableDevices}`)
  process.exit(1)
}

let browser
try {
  browser = await chromium.launch({ headless: false })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (!message.includes("Executable doesn't exist")) {
    throw error
  }
  browser = await chromium.launch({ headless: false, channel: 'chrome' })
}
const context = await browser.newContext(deviceProfile)
const page = await context.newPage()

const shutdown = async () => {
  await context.close()
  await browser.close()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown()
})
process.on('SIGTERM', () => {
  void shutdown()
})

await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
await page.bringToFront()
await page.waitForEvent('close', { timeout: 0 })
await shutdown()
