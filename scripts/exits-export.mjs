/**
 * 本轮新功能回归测试：
 *   1) 出口可调整离站远近（dist）—— 不再是固定同一距离
 *   2) 导出新增「整体线路 / 按地铁（每条线一张）」范围 + 「白底/透明/地图底图」背景
 * 用法：node scripts/exits-export.mjs
 * 前提：dev server 已在 http://localhost:5173 运行
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(String(err)))
page.on('dialog', (d) => {
  console.log('  [dialog]', d.type(), d.message())
  d.dismiss().catch(() => {})
})

const workId = () =>
  page.url().match(/#\/editor\/(.+)/)?.[1] ?? null

console.log('0. 新建作品')
await page.goto(BASE, { waitUntil: 'load' })
await page.getByRole('button', { name: /新建地铁图/ }).click()
await page.locator('.dialog-input').first().fill('出口距离与导出验证')
await page.getByRole('button', { name: /开始创作/ }).click()
await page.waitForURL(/#\/editor\//, { timeout: 8000 })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
await page.waitForTimeout(2500)

if ((await page.locator('.panel-tab-toolbar').count()) > 0)
  await page.locator('.panel-tab-toolbar').click()
await page.waitForTimeout(300)

const mapBox = await page.locator('.map-canvas').boundingBox()
const cx = mapBox.x + mapBox.width / 2
const cy = mapBox.y + mapBox.height / 2
const pts = [
  [cx - 160, cy - 80],
  [cx + 160, cy + 80],
]

console.log('1. 画线 2 站')
for (const [x, y] of pts) {
  await page.mouse.click(x, y)
  await page.waitForTimeout(180)
}
await page.waitForTimeout(400)
const drawn = await page.locator('.station-marker').count()
check(`放出 2 个站点（实际 ${drawn}）`, drawn === 2)

console.log('2. 出口距离可调')
await page.getByRole('button', { name: /调整/ }).click()
await page.waitForTimeout(150)
await page.mouse.click(pts[0][0], pts[0][1])
await page.waitForSelector('.selection-bar', { timeout: 3000 })
await page.getByRole('button', { name: /＋ 出口/ }).click()
await page.waitForTimeout(200)
check('出现距离滑块 .exit-dist', (await page.locator('.exit-dist').count()) >= 1)
// 把距离设为 1.5（更远离站）—— 用原生 setter 绕过 React 的 value tracker，确保 onChange 触发
await page.locator('.exit-dist').first().evaluate((el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, '1.5')
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(1400) // 等自动保存（1s 防抖）落盘
const distVal = await page.evaluate(async () => {
  const wid = location.hash.match(/#\/editor\/(.+)/)?.[1]
  const db = await new Promise((res, rej) => {
    const o = indexedDB.open('metro-designer')
    o.onsuccess = () => res(o.result)
    o.onerror = () => rej(o.error)
  })
  const rec = await new Promise((res, rej) => {
    const t = db.transaction('works', 'readonly')
    const r = t.objectStore('works').get('md:work:' + wid)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  const st = Object.values(rec?.stations ?? {}).find((s) => (s.exits ?? []).length >= 1)
  return st?.exits?.[0]?.dist ?? null
})
check(`出口距离已写入 IndexedDB（实际 ${distVal}，期望 1.5）`, distVal === 1.5)
await page.screenshot({ path: `${SHOTS}/ee-1-exit-dist.png` })

console.log('3. 导出对话框：范围 + 背景选项')
// 关闭选中栏
await page.locator('.selection-bar .btn', { hasText: '✖️' }).last().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /📤 导出/ }).click()
await page.waitForSelector('.dialog', { timeout: 3000 })
check('含「整体线路」范围按钮', (await page.getByRole('button', { name: /整体线路/ }).count()) >= 1)
check('含「按地铁（每条线一张）」范围按钮', (await page.getByRole('button', { name: /按地铁/ }).count()) >= 1)
check('含「白底」背景按钮', (await page.getByRole('button', { name: /白底/ }).count()) >= 1)
check('含「透明」背景按钮', (await page.getByRole('button', { name: /^透明$/ }).count()) >= 1)
check('含「地图底图」背景按钮', (await page.getByRole('button', { name: /地图底图/ }).count()) >= 1)
await page.screenshot({ path: `${SHOTS}/ee-2-export-dialog.png` })

console.log('4. 整体 + 白底 PNG 导出可触发下载')
const downloads = []
page.on('download', async (d) => {
  downloads.push(d)
  try {
    console.log('  [download]', d.suggestedFilename())
  } catch {
    /* ignore */
  }
})
await page.getByRole('button', { name: /整体线路/ }).click()
await page.getByRole('button', { name: /白底/ }).click()
await page.getByRole('button', { name: /PNG 图片（清晰）/ }).click()
await page.waitForEvent('download', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(800)
check('整体白底 PNG 至少触发一次下载', downloads.length >= 1)

console.log('5. 按地铁（每条线一张）PNG 导出')
// 上一步成功导出后对话框会关闭，这里重新打开
await page.getByRole('button', { name: /📤 导出/ }).click()
await page.waitForSelector('.dialog', { timeout: 3000 })
await page.getByRole('button', { name: /按地铁（每条线一张）/ }).click()
await page.getByRole('button', { name: /白底/ }).click()
await page.getByRole('button', { name: /PNG 图片（超清）/ }).click()
await page.waitForEvent('download', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(600)
check('按地铁（每条线一张）PNG 触发下载', downloads.length >= 2)

console.log('6. 按地铁 + 地图底图 PNG（放大并带地图背景，可无网降级）')
await page.getByRole('button', { name: /📤 导出/ }).click()
await page.waitForSelector('.dialog', { timeout: 3000 })
await page.getByRole('button', { name: /按地铁（每条线一张）/ }).click()
await page.getByRole('button', { name: /地图底图/ }).click()
await page.getByRole('button', { name: /PNG 图片（清晰）/ }).click()
await page.waitForEvent('download', { timeout: 60000 }).catch(() => {})
await page.waitForTimeout(600)
console.log('  downloads so far:', downloads.length)
check('按地铁+地图底图 PNG 触发下载（含降级）', downloads.length >= 3)

await browser.close()

console.log('\n========== 出口距离 & 导出 测试结果 ==========')
console.log(`通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) console.log('失败项：', failed)
const realErrors = errors.filter(
  (e) => !e.includes('tile') && !e.includes('net::ERR') && !e.includes('favicon'),
)
if (realErrors.length) {
  console.log('控制台错误：')
  realErrors.forEach((e) => console.log('  -', e.slice(0, 200)))
}
process.exit(failed.length || realErrors.length ? 1 : 0)
