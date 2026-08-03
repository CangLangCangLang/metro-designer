/**
 * v3 新功能测试：点站成换乘、换乘线路管理、时速系统
 * 用法：node scripts/speed-transfer.mjs（需 dev server 运行）
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const SHOTS = 'scripts/shots'
mkdirSync(SHOTS, { recursive: true })

let passed = 0
const failed = []
const errors = []
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
page.on('pageerror', (e) => errors.push(String(e)))

console.log('1. 画 1号线（2 站）')
await page.goto(BASE, { waitUntil: 'load' })
await page.getByRole('button', { name: /新建地铁图/ }).click()
await page.getByRole('button', { name: /开始创作/ }).click()
await page.waitForURL(/#\/editor\//)
await page.waitForTimeout(2500)
await page.locator('.panel-tab-toolbar').click()
await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(300)
const mapBox = await page.locator('.map-canvas').boundingBox()
const cx = mapBox.x + mapBox.width / 2
const cy = mapBox.y + mapBox.height / 2
const st1 = [cx - 150, cy - 80]
const st2 = [cx + 150, cy + 80]
await page.mouse.click(st1[0], st1[1])
await page.waitForTimeout(200)
await page.mouse.click(st2[0], st2[1])
await page.waitForTimeout(300)
check('1号线 2 站', (await page.locator('.st-dot').count()) === 2)

console.log('2. 新线直接点击已有站 = 换乘')
await page.getByRole('button', { name: /新线路/ }).click()
await page.waitForTimeout(300)
// 先在下方放一个 2号线的新站
await page.mouse.click(cx - 140, cy + 200)
await page.waitForTimeout(200)
// 直接点击 1号线的 st1（正中 marker）→ 应连入 2号线形成换乘
await page.mouse.click(st1[0], st1[1])
await page.waitForTimeout(300)
check('点击已有站直接连入（换乘站出现）', (await page.locator('.st-dot.transfer').count()) === 1)
check('没有多放新站（仍 3 站）', (await page.locator('.st-dot').count()) === 3)
await page.screenshot({ path: `${SHOTS}/v1-click-transfer.png` })

console.log('3. 换乘站线路管理 chips')
await page.getByRole('button', { name: /🔒 看看/ }).click() // 切浏览模式，点击=选中
await page.waitForTimeout(200)
await page.mouse.click(st1[0], st1[1])
await page.waitForTimeout(400)
check('操作栏出现', await page.locator('.selection-bar').isVisible())
check('显示 1号线 chip', await page.locator('.transfer-line-chip', { hasText: '1号线' }).isVisible())
check('显示 2号线 chip', await page.locator('.transfer-line-chip', { hasText: '2号线' }).isVisible())
await page.screenshot({ path: `${SHOTS}/v2-transfer-chips.png` })
// 从 2号线移出
await page.locator('.transfer-line-chip', { hasText: '2号线' }).locator('.chip-remove').click()
await page.waitForTimeout(300)
check('移出后换乘消失', (await page.locator('.st-dot.transfer').count()) === 0)
check('站点仍在（1号线上）', (await page.locator('.st-dot').count()) === 3)
await page.locator('.selection-bar .btn', { hasText: '✖️' }).last().click()
await page.waitForTimeout(200)

console.log('4. 线路时速设置')
const speedBtn = page.locator('.line-card', { hasText: '1号线' }).locator('.style-btn-speed')
check('默认时速 80', (await speedBtn.textContent())?.includes('80') ?? false)
await speedBtn.click()
await page.waitForTimeout(200)
check('点击后变 100', (await speedBtn.textContent())?.includes('100') ?? false)

console.log('5. 区间时速与全程时间')
await page.locator('.line-card', { hasText: '1号线' }).locator('.line-detail-toggle').click()
await page.waitForTimeout(300)
check('站点列表展开', await page.locator('.station-list').isVisible())
const segBtn = page.locator('.seg-speed-btn').first()
check('区间默认跟随线路时速（100）', (await segBtn.textContent())?.includes('100') ?? false)
await segBtn.click()
await page.waitForTimeout(200)
check('点击后区间变 40', (await segBtn.textContent())?.includes('40') ?? false)
check('自定义区间高亮', await page.locator('.seg-speed-btn.seg-speed-custom').first().isVisible())
check('全程时间显示', await page.locator('.trip-time').isVisible())
check('时间格式正确', /约 \d+ 分钟/.test((await page.locator('.trip-time').textContent()) ?? ''))
const tripText = (await page.locator('.trip-time').textContent()) ?? ''
const tripMin = parseInt(/约 (\d+)/.exec(tripText)?.[1] ?? '0')
check(`时间数值大于0（${tripMin}分钟）`, tripMin > 0)
await page.screenshot({ path: `${SHOTS}/v3-seg-speed.png` })

console.log('6. 播放倍率（不影响时速设置）')
await page.locator('.line-card', { hasText: '1号线' }).locator('button[title*="列车"]').click()
await page.waitForTimeout(800)
check('列车在跑', (await page.locator('.train-token').count()) === 1)
check('倍率控件出现', await page.locator('.train-controls').isVisible())
await page.locator('.speed-btn', { hasText: '🚀' }).click()
await page.waitForTimeout(200)
check('快进档激活', await page.locator('.speed-btn.speed-active', { hasText: '🚀' }).isVisible())
check('线卡时速设置保持 100', (await speedBtn.textContent())?.includes('100') ?? false)

await browser.close()
console.log('\n========== 结果 ==========')
console.log(`通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) console.log('失败项：', failed)
if (errors.length) console.log('页面错误：', errors)
process.exit(failed.length || errors.length ? 1 : 0)
