/**
 * 冒烟测试：验证「我的地铁设计师」核心流程
 * 用法：node scripts/smoke.mjs
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

console.log('1. 画廊首页')
await page.goto(BASE, { waitUntil: 'load' })
check('标题可见', await page.getByText('我的地铁设计师').first().isVisible())
check('新建按钮可见', await page.getByRole('button', { name: /新建地铁图/ }).isVisible())
await page.screenshot({ path: `${SHOTS}/1-gallery-empty.png` })

console.log('2. 新建作品 → 进入编辑器')
await page.getByRole('button', { name: /新建地铁图/ }).click()
await page.locator('.dialog-input').first().fill('我的北京地铁')
await page.getByRole('button', { name: /开始创作/ }).click()
await page.waitForURL(/#\/editor\//, { timeout: 8000 })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
await page.waitForTimeout(3000) // 等瓦片加载
check('进入编辑器', page.url().includes('#/editor/'))
check('面板默认收起：工具小按钮可见', await page.locator('.panel-tab-toolbar').isVisible())
check('面板默认收起：线路小按钮可见', await page.locator('.panel-tab-lines').isVisible())
// 展开面板后继续
await page.locator('.panel-tab-toolbar').click()
await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(300)
check('展开后工具栏可见', await page.locator('.toolbar').isVisible())
check('展开后线路面板可见', await page.locator('.line-panel').isVisible())
await page.screenshot({ path: `${SHOTS}/2-editor-blank.png` })

console.log('3. 画线模式：点击地图放站')
const mapBox = await page.locator('.map-canvas').boundingBox()
const cx = mapBox.x + mapBox.width / 2
const cy = mapBox.y + mapBox.height / 2
const points = [
  [cx - 200, cy - 120],
  [cx - 80, cy - 40],
  [cx + 40, cy],
  [cx + 160, cy + 80],
  [cx + 260, cy + 140],
]
for (const [x, y] of points) {
  await page.mouse.click(x, y)
  await page.waitForTimeout(200)
}
await page.waitForTimeout(500)
const stationCount = await page.locator('.st-dot').count()
check(`放出 5 个站点（实际 ${stationCount}）`, stationCount === 5)
check('首次点击自动创建了 1号线', await page.getByText('1号线').first().isVisible())
check('线路显示 5 站', await page.getByText('5站').first().isVisible())
await page.screenshot({ path: `${SHOTS}/3-line-drawn.png` })

console.log('4. 撤销/重做')
await page.keyboard.press('Control+z')
await page.waitForTimeout(300)
check('撤销后 4 站', (await page.locator('.st-dot').count()) === 4)
await page.keyboard.press('Control+y')
await page.waitForTimeout(300)
check('重做后 5 站', (await page.locator('.st-dot').count()) === 5)

console.log('5. 站点改名（选中操作栏）')
await page.mouse.click(points[2][0], points[2][1])
await page.waitForSelector('.selection-bar', { timeout: 3000 })
await page.locator('.station-name-input').fill('天安门东')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('站名改为 天安门东', await page.getByText('天安门东').first().isVisible())
await page.locator('.selection-bar .btn', { hasText: '✖️' }).last().click()
await page.waitForTimeout(200)

console.log('6. 新建第二条线 + 换乘吸附')
await page.getByRole('button', { name: /新线路/ }).click()
await page.waitForTimeout(300)
check('出现 2号线', await page.getByText('2号线').first().isVisible())
// 从下方画一条线穿过中间站附近（吸附换乘）
// 注意：点击位置要避开已有站点的 34px 命中区（否则会变成选中站点），
// 但要在 SNAP_PX(34px) 吸附半径内 → 水平偏移 24px
const cross = [
  [points[2][0] - 60, cy - 160],
  [points[2][0] + 24, points[2][1]], // 中间站右侧 24px → 应吸附为换乘
  [points[2][0] + 80, cy + 200],
]
for (const [x, y] of cross) {
  await page.mouse.click(x, y)
  await page.waitForTimeout(200)
}
await page.waitForTimeout(400)
const transferCount = await page.locator('.st-dot.transfer').count()
check(`形成换乘站（换乘站数 ${transferCount}）`, transferCount >= 1)
await page.screenshot({ path: `${SHOTS}/4-transfer.png` })

console.log('7. 列车动画')
await page.locator('.line-card', { hasText: '1号线' }).locator('button[title*="跑车"], button[title*="列车"]').first().click()
await page.waitForTimeout(300)
await page.locator('.line-card', { hasText: '2号线' }).locator('button[title*="跑车"], button[title*="列车"]').first().click()
await page.waitForTimeout(1500)
const trainCount = await page.locator('.train-token').count()
check(`两条线都有列车在跑（列车数 ${trainCount}）`, trainCount === 2)
check('列车总控出现', await page.locator('.train-controls').isVisible())
await page.screenshot({ path: `${SHOTS}/5-trains.png` })

console.log('8. 贴纸')
await page.getByRole('button', { name: /贴纸/ }).click()
await page.waitForSelector('.sticker-palette')
await page.locator('.sticker-item', { hasText: '✈️' }).click()
await page.mouse.click(cx + 300, cy - 180)
await page.waitForTimeout(300)
check('贴纸已放置', (await page.locator('.sticker-marker').count()) >= 1)
await page.getByText('不放了').click()
await page.screenshot({ path: `${SHOTS}/6-sticker.png` })

console.log('9. 自动保存 → 刷新恢复')
await page.waitForTimeout(2500) // 等防抖落盘
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(2500)
check('刷新后站点还在（5+2）', (await page.locator('.st-dot').count()) === 7)
check('刷新后贴纸还在', (await page.locator('.sticker-marker').count()) >= 1)

console.log('10. 导出对话框')
await page.getByRole('button', { name: /导出/ }).click()
await page.waitForSelector('.dialog')
check('导出对话框打开', await page.getByText('PNG 图片（清晰）').isVisible())

// SVG 导出（下载事件）
const [svgDownload] = await Promise.all([
  page.waitForEvent('download', { timeout: 10000 }),
  page.getByRole('button', { name: /SVG 矢量图/ }).click(),
])
const svgPath = await svgDownload.path()
check('SVG 文件已下载', Boolean(svgPath))

// PNG 导出（验证 SVG→canvas 渲染管线，会真解析 SVG XML）
await page.getByRole('button', { name: /导出/ }).click()
await page.waitForSelector('.dialog')
const [pngDownload] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.getByRole('button', { name: /PNG 图片（清晰）/ }).click(),
])
check('PNG 文件已下载', Boolean(await pngDownload.path()))
await page.screenshot({ path: `${SHOTS}/7-export.png` })

console.log('11. 打印页')
// SVG 导出后对话框已自动关闭，重新打开
await page.getByRole('button', { name: /导出/ }).click()
await page.waitForSelector('.dialog')
await page.getByRole('button', { name: /去打印/ }).click()
await page.waitForURL(/#\/print\//, { timeout: 8000 })
await page.waitForTimeout(1000)
check('打印页 SVG 渲染', (await page.locator('.print-sheet svg').count()) === 1)
check('图例包含 1号线', await page.locator('.print-sheet svg').getByText(/1号线/).first().isVisible())
await page.screenshot({ path: `${SHOTS}/8-print.png`, fullPage: true })

console.log('12. 返回画廊 → 作品卡片')
await page.goto(BASE + '/#/', { waitUntil: 'load' })
await page.waitForTimeout(2000)
check('画廊有作品卡', (await page.locator('.work-card').count()) >= 1)
check('缩略图已生成', (await page.locator('.work-thumb img').count()) >= 1)
check('卡片显示 2 条线', await page.getByText(/2 条线/).first().isVisible())
await page.screenshot({ path: `${SHOTS}/9-gallery.png` })

await browser.close()

console.log('\n========== 结果 ==========')
console.log(`通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) console.log('失败项：', failed)
const realErrors = errors.filter(
  (e) =>
    !e.includes('tile') && // 瓦片加载偶发失败不算
    !e.includes('net::ERR') &&
    !e.includes('favicon'),
)
if (realErrors.length) {
  console.log('控制台错误：')
  realErrors.forEach((e) => console.log('  -', e.slice(0, 200)))
}
process.exit(failed.length || realErrors.length ? 1 : 0)
