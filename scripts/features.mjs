/**
 * 新功能测试：曲线/虚线/画笔/城市搜索/里程/列车图标
 * 用法：node scripts/features.mjs（需 dev server 运行）
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

console.log('1. 新建作品并画 4 站')
await page.goto(BASE, { waitUntil: 'load' })
await page.getByRole('button', { name: /新建地铁图/ }).click()
await page.getByRole('button', { name: /开始创作/ }).click()
await page.waitForURL(/#\/editor\//)
await page.waitForTimeout(2500)
// 面板默认收起，先展开
await page.locator('.panel-tab-toolbar').click()
await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(300)
const mapBox = await page.locator('.map-canvas').boundingBox()
const cx = mapBox.x + mapBox.width / 2
const cy = mapBox.y + mapBox.height / 2
const pts = [
  [cx - 180, cy - 100],
  [cx - 60, cy + 60],
  [cx + 80, cy - 80],
  [cx + 200, cy + 40],
]
for (const [x, y] of pts) {
  await page.mouse.click(x, y)
  await page.waitForTimeout(150)
}
await page.waitForTimeout(400)
check('放出 4 个站', (await page.locator('.st-dot').count()) === 4)

console.log('2. 直线 → 曲线')
const pathBefore = await page.locator('.leaflet-overlay-pane svg path').first().getAttribute('d')
await page.locator('.line-card .style-btn', { hasText: '曲线' }).click()
await page.waitForTimeout(400)
const pathAfter = await page.locator('.leaflet-overlay-pane svg path').first().getAttribute('d')
check('曲线模式 path 变化（更密集）', pathBefore !== pathAfter && pathAfter.length > pathBefore.length)
await page.screenshot({ path: `${SHOTS}/f1-smooth.png` })

console.log('3. 实线 → 虚线')
await page.locator('.line-card .style-btn', { hasText: '虚线' }).click()
await page.waitForTimeout(400)
const dashCount = await page.locator('.leaflet-overlay-pane svg path[stroke-dasharray]').count()
check(`虚线 dasharray 生效（${dashCount} 条虚线层）`, dashCount >= 2)
await page.screenshot({ path: `${SHOTS}/f2-dashed.png` })

console.log('4. 里程显示与站点列表')
check('线路卡显示公里数', await page.getByText(/4站 · \d+(\.\d+)?(公里|米)/).first().isVisible())
await page.locator('.line-detail-toggle').click()
await page.waitForTimeout(300)
check('站点列表展开', await page.locator('.station-list').isVisible())
check('站间距显示', (await page.locator('.station-list-gap').count()) === 3)
await page.screenshot({ path: `${SHOTS}/f3-mileage.png` })
await page.locator('.line-detail-toggle').click()

console.log('5. 自由画笔')
await page.getByRole('button', { name: /🖌️ 画笔/ }).click()
await page.waitForTimeout(200)
// 按住拖动一段弧线
await page.mouse.move(cx - 200, cy + 200)
await page.mouse.down()
for (let i = 0; i <= 20; i++) {
  await page.mouse.move(cx - 200 + i * 15, cy + 200 - Math.sin((i / 20) * Math.PI) * 80)
  await page.waitForTimeout(20)
}
await page.mouse.up()
await page.waitForTimeout(400)
check('画笔线条已保存', (await page.locator('.leaflet-overlay-pane svg path').count()) >= 5)
await page.screenshot({ path: `${SHOTS}/f4-freehand.png` })
// 点选笔迹并删除
const fhHit = [cx - 100, cy + 200 - Math.sin(0.5 * Math.PI) * 80]
await page.mouse.click(fhHit[0], fhHit[1] + 6)
await page.waitForTimeout(400)
const hasSelection = await page.locator('.selection-bar').isVisible().catch(() => false)
check('点击笔迹弹出操作栏', hasSelection)
if (hasSelection) {
  await page.getByRole('button', { name: '🗑️ 删除' }).click()
  await page.waitForTimeout(300)
  check('笔迹已删除', !(await page.locator('.selection-bar').isVisible().catch(() => false)))
}

console.log('6. 城市搜索')
await page.getByRole('button', { name: /找城市/ }).click()
await page.waitForSelector('.dialog-city')
await page.locator('.dialog-city .dialog-input').fill('lz')
await page.waitForTimeout(300)
check('拼音 lz 能搜到兰州', await page.locator('.city-item', { hasText: '兰州' }).first().isVisible())
await page.locator('.dialog-city .dialog-input').fill('西双版纳')
await page.waitForTimeout(300)
check('中文搜到西双版纳（无地铁城市）', await page.locator('.city-item', { hasText: '西双版纳' }).isVisible())
await page.locator('.city-item', { hasText: '西双版纳' }).click()
await page.waitForTimeout(2500) // flyTo 动画 + moveend
// 从 IndexedDB 验证地图视角已飞到西双版纳
const viewLat = await page.evaluate(async () => {
  const req = indexedDB.open('metro-designer')
  return await new Promise((res) => {
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('works', 'readonly')
      const getAll = tx.objectStore('works').getAll()
      getAll.onsuccess = () => {
        const work = getAll.result.find((v) => typeof v === 'object' && v && 'view' in v)
        res(work?.view?.lat ?? 0)
      }
      req.onerror = () => res(0)
    }
    req.onerror = () => res(0)
  })
})
check(`地图已飞到西双版纳（lat≈22，实际 ${viewLat?.toFixed?.(2)}）`, Math.abs(viewLat - 22.0) < 0.5)

console.log('7. 列车地铁图标')
// 切回画线模式并开启列车
await page.locator('.line-card').first().click()
await page.waitForTimeout(200)
await page.locator('.line-card button[title*="列车"]').first().click()
await page.waitForTimeout(1200)
check('列车 emoji 存在', (await page.locator('.train-emoji').count()) === 1)
await page.screenshot({ path: `${SHOTS}/f5-train.png` })

console.log('8. 导出 SVG 含曲线/虚线/画笔/里程')
await page.getByRole('button', { name: /导出/ }).click()
await page.waitForSelector('.dialog')
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 10000 }),
  page.getByRole('button', { name: /SVG 矢量图/ }).click(),
])
const svgPath = await download.path()
const { readFileSync } = await import('node:fs')
const svg = readFileSync(svgPath, 'utf-8')
check('SVG 含贝塞尔曲线（C 命令）', svg.includes(' C'))
check('SVG 含虚线 dasharray', svg.includes('stroke-dasharray'))
check('SVG 图例含公里数', /\d+站 · \d+(\.\d+)?(公里|米)/.test(svg))
await page.screenshot({ path: `${SHOTS}/f6-export.png` })

await browser.close()
console.log('\n========== 结果 ==========')
console.log(`通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) console.log('失败项：', failed)
if (errors.length) console.log('页面错误：', errors)
process.exit(failed.length || errors.length ? 1 : 0)
