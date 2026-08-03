/**
 * 面板收起/展开验证
 * 用法：node scripts/collapse.mjs（需 dev server 运行）
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const SHOTS = 'scripts/shots'
mkdirSync(SHOTS, { recursive: true })

let passed = 0
const failed = []
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
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

console.log('1. 进入编辑器（面板默认收起）')
await page.goto(BASE, { waitUntil: 'load' })
await page.getByRole('button', { name: /新建地铁图/ }).click()
await page.getByRole('button', { name: /开始创作/ }).click()
await page.waitForURL(/#\/editor\//)
await page.waitForTimeout(2500)
check('默认收起：工具栏隐藏', !(await page.locator('.toolbar').isVisible().catch(() => false)))
check('默认收起：线路面板隐藏', !(await page.locator('.line-panel').isVisible().catch(() => false)))
check('默认收起：工具小按钮可见', await page.locator('.panel-tab-toolbar').isVisible())
check('默认收起：线路小按钮可见', await page.locator('.panel-tab-lines').isVisible())
await page.screenshot({ path: `${SHOTS}/c1-collapsed.png` })

console.log('2. 展开两个面板')
await page.locator('.panel-tab-toolbar').click()
await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(400)
check('工具栏展开', await page.locator('.toolbar').isVisible())
check('线路面板展开', await page.locator('.line-panel').isVisible())

console.log('2b. 再收起')
await page.getByTitle('收起工具栏，画图更宽敞').click()
await page.getByTitle('收起面板，画图更宽敞').click()
await page.waitForTimeout(400)
check('工具栏已隐藏', !(await page.locator('.toolbar').isVisible().catch(() => false)))
check('线路面板已隐藏', !(await page.locator('.line-panel').isVisible().catch(() => false)))

console.log('3. 收起状态下仍能画线（点地图放站）')
const mapBox = await page.locator('.map-canvas').boundingBox()
const cx = mapBox.x + mapBox.width / 2
const cy = mapBox.y + mapBox.height / 2
await page.mouse.click(cx - 100, cy - 60)
await page.waitForTimeout(200)
await page.mouse.click(cx + 100, cy + 60)
await page.waitForTimeout(300)
check('收起状态放出 2 个站', (await page.locator('.station-marker').count()) === 2)

console.log('4. 展开恢复')
await page.locator('.panel-tab-toolbar').click()
await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(400)
check('工具栏恢复', await page.locator('.toolbar').isVisible())
check('线路面板恢复', await page.locator('.line-panel').isVisible())
check('自动建的线路显示在线路面板', await page.getByText('1号线').first().isVisible())
await page.screenshot({ path: `${SHOTS}/c2-expanded.png` })

console.log('5. 收起状态被记忆（刷新后仍收起）')
await page.getByTitle('收起工具栏，画图更宽敞').click()
await page.getByTitle('收起面板，画图更宽敞').click()
await page.waitForTimeout(200)
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(2500)
check('刷新后工具栏仍收起', await page.locator('.panel-tab-toolbar').isVisible())
check('刷新后线路面板仍收起', await page.locator('.panel-tab-lines').isVisible())

await browser.close()
console.log('\n========== 结果 ==========')
console.log(`通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) console.log('失败项：', failed)
if (errors.length) console.log('页面错误：', errors)
process.exit(failed.length || errors.length ? 1 : 0)
