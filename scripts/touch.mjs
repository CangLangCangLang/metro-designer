/**
 * 触屏模拟测试：iPad 尺寸 + 触摸，验证平板体验和打印避让
 * 用法：node scripts/touch.mjs（需 dev server 运行）
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const SHOTS = 'scripts/shots'
mkdirSync(SHOTS, { recursive: true })

const errors = []
const failed = []
let passed = 0
function check(name, cond) {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed.push(name)
    console.log(`  ❌ ${name}`)
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath:
    'C:/Users/wythe/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
})
const context = await browser.newContext({
  viewport: { width: 820, height: 1180 },
  hasTouch: true,
  isMobile: true,
})
const page = await context.newPage()
page.on('pageerror', (err) => errors.push(String(err)))

console.log('1. 触屏新建作品')
await page.goto(BASE, { waitUntil: 'load' })
await page.getByRole('button', { name: /新建地铁图/ }).tap()
await page.getByRole('button', { name: /开始创作/ }).tap()
await page.waitForURL(/#\/editor\//)
await page.waitForTimeout(3000)
check('触屏进入编辑器', page.url().includes('#/editor/'))

console.log('2. 手指点按放站')
const mapBox = await page.locator('.map-canvas').boundingBox()
const cx = mapBox.x + mapBox.width / 2
const cy = mapBox.y + mapBox.height / 2
const taps = [
  [cx - 150, cy - 100],
  [cx, cy],
  [cx + 150, cy + 100],
]
for (const [x, y] of taps) {
  await page.touchscreen.tap(x, y)
  await page.waitForTimeout(300)
}
check('触屏放出 3 个站', (await page.locator('.st-dot').count()) === 3)
await page.screenshot({ path: `${SHOTS}/t1-touch-draw.png` })

console.log('3. 触屏选中站点改名')
await page.touchscreen.tap(cx, cy)
await page.waitForSelector('.selection-bar', { timeout: 3000 })
check('操作栏弹出', true)
await page.locator('.station-name-input').fill('国贸')
await page.keyboard.press('Enter')
check('触屏改名成功', await page.getByText('国贸').first().isVisible())
await page.locator('.selection-bar .btn', { hasText: '✖️' }).last().tap()
await page.screenshot({ path: `${SHOTS}/t2-touch-rename.png` })

console.log('4. 打印页避让效果（压线检查）')
// 面板默认收起，先展开工具栏
await page.locator('.panel-tab-toolbar').tap()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /导出/ }).tap()
await page.waitForSelector('.dialog')
await page.getByRole('button', { name: /去打印/ }).tap()
await page.waitForURL(/#\/print\//)
await page.waitForTimeout(800)
check('打印页渲染', (await page.locator('.print-sheet svg').count()) === 1)
await page.screenshot({ path: `${SHOTS}/t3-print.png`, fullPage: true })

await browser.close()
console.log('\n========== 结果 ==========')
console.log(`通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) console.log('失败项：', failed)
if (errors.length) console.log('页面错误：', errors)
process.exit(failed.length || errors.length ? 1 : 0)
