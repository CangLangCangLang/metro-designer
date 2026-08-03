/**
 * 新功能回归测试：覆盖本轮 7 项需求
 *   1) 调色板扩到 24 色
 *   2) 本地自动保存 + 刷新/版本兼容（schema 迁移）
 *   3) 平板端布局不重叠、触控友好
 *   4) 线路编辑支持「插入上一站 / 下一站」
 *   5) 换乘站编辑（徽标 + 单线移出）
 *   6) 站点出口与出口编号
 *   7) 站点自定义图标（emoji）
 * 用法：node scripts/newfeatures.mjs
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

const src = (id) => page.locator('.line-card', { hasText: id })
const boxOf = async (sel) => (await page.locator(sel).first().boundingBox()) ?? null

// 从 URL hash 解析作品 id
const workId = () =>
  page
    .url()
    .match(/#\/editor\/(.+)/)?.[1] ?? null

console.log('0. 新建作品')
await page.goto(BASE, { waitUntil: 'load' })
await page.getByRole('button', { name: /新建地铁图/ }).click()
await page.locator('.dialog-input').first().fill('新功能验证图')
await page.getByRole('button', { name: /开始创作/ }).click()
await page.waitForURL(/#\/editor\//, { timeout: 8000 })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
await page.waitForTimeout(2500) // 等瓦片

// 展开工具栏与线路面板（默认收起），确保模式按钮/线路操作可见可点
if ((await page.locator('.panel-tab-toolbar').count()) > 0)
  await page.locator('.panel-tab-toolbar').click()
if ((await page.locator('.panel-tab-lines').count()) > 0)
  await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(300)

const mapBox = await page.locator('.map-canvas').boundingBox()
const cx = mapBox.x + mapBox.width / 2
const cy = mapBox.y + mapBox.height / 2
const pts = [
  [cx - 180, cy - 120],
  [cx - 60, cy - 40],
  [cx + 60, cy + 20],
  [cx + 180, cy + 100],
]

console.log('1. 画线（4 站）→ 验证调色板 24 色')
for (const [x, y] of pts) {
  await page.mouse.click(x, y)
  await page.waitForTimeout(180)
}
await page.waitForTimeout(400)
const drawn = await page.locator('.station-marker').count()
check(`放出 4 个站点（实际 ${drawn}）`, drawn === 4)
check('新站默认带图标（不再是清一色圆点）', (await page.locator('.st-dot').count()) === 0 && (await page.locator('.st-icon').count()) === 4)

// 1b. 画笔：起点/终点吸附到站点，避免画出脱离线路的悬空线
console.log('1b. 画笔起点/终点吸附到站点')
await page.getByRole('button', { name: /🖌️ 画笔/ }).click()
await page.waitForTimeout(200)
// 从站点0 画一条向上拱起的弧线，落到站点2（两端都恰好压在站点上 → 吸附）
await page.mouse.move(pts[0][0], pts[0][1])
await page.mouse.down()
await page.mouse.move(pts[0][0] - 10, pts[0][1] - 120)
await page.mouse.move((pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2 - 160)
await page.mouse.move(pts[2][0] + 10, pts[2][1] - 120)
await page.mouse.move(pts[2][0], pts[2][1])
await page.waitForTimeout(40)
await page.mouse.up()
await page.waitForTimeout(1200) // 等自动保存落盘
const fhSnap = await page.evaluate(async () => {
  const wid = location.hash.match(/#\/editor\/(.+)/)?.[1]
  const db = await new Promise((res, rej) => { const o = indexedDB.open('metro-designer'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error) })
  const rec = await new Promise((res, rej) => { const t = db.transaction('works', 'readonly'); const r = t.objectStore('works').get('md:work:' + wid); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const fhs = rec?.freehands ?? []
  return fhs[fhs.length - 1] ?? null
})
check('画笔起点吸附到站点（startStationId 非空）', fhSnap && Boolean(fhSnap.startStationId))
check('画笔终点吸附到站点（endStationId 非空）', fhSnap && Boolean(fhSnap.endStationId))
// 选中并删除这条画笔（弧线顶点远离真实线路，避免误触线段）
await page.getByRole('button', { name: /调整/ }).click()
await page.waitForTimeout(200)
await page.mouse.click((pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2 - 160)
await page.waitForTimeout(400)
if (await page.locator('.selection-bar').isVisible().catch(() => false)) {
  await page.getByRole('button', { name: '🗑️ 删除' }).click()
  await page.waitForTimeout(300)
  check('画笔可删除（选中栏消失）', !(await page.locator('.selection-bar').isVisible().catch(() => false)))
} else {
  check('画笔可删除（选中栏消失）', false)
}

// 展开线路面板
if ((await page.locator('.panel-tab-lines').count()) > 0)
  await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(250)
// 打开 1号线 颜色面板
await src('1号线').locator('.line-color-dot').click()
await page.waitForSelector('.color-palette')
const swatchCount = await page.locator('.color-swatch').count()
check(`调色板有 24 种颜色（实际 ${swatchCount}）`, swatchCount === 24)
await page.screenshot({ path: `${SHOTS}/nf-1-palette.png` })
// 关掉颜色面板
await page.keyboard.press('Escape')
await src('1号线').locator('.line-color-dot').click().catch(() => {})
await page.waitForTimeout(200)

console.log('4. 插入上一站 / 下一站')
src('1号线').locator('.line-st-count').click() // 展开站点列表
await page.waitForSelector('.insert-before-btn', { timeout: 3000 })
// 首站前插入
await page.locator('.insert-before-btn').first().click()
await page.waitForTimeout(300)
const afterBefore = await page.locator('.station-marker').count()
check(`插入上一站后 5 站（实际 ${afterBefore}）`, afterBefore === 5)
// 末尾插入
await page.locator('.insert-before-btn.insert-at-end').click()
await page.waitForTimeout(300)
const afterEnd = await page.locator('.station-marker').count()
check(`插入下一站后 6 站（实际 ${afterEnd}）`, afterEnd === 6)
await page.screenshot({ path: `${SHOTS}/nf-2-insert.png` })

console.log('7. 自定义站点图标（多层菜单 + 默认圆点可还原）')
// 切到「调整」模式，点选第 2 个原始站（pts[0]）以稳定选择
await page.getByRole('button', { name: /调整/ }).click()
await page.waitForTimeout(150)
await page.mouse.click(pts[0][0], pts[0][1])
await page.waitForSelector('.selection-bar', { timeout: 3000 })
await page.waitForSelector('.icon-pick-btn', { timeout: 3000 })
// 打开图标菜单，选 🏥
await page.locator('.icon-pick-btn').click()
await page.waitForSelector('.icon-picker')
await page.locator('.icon-picker .icon-choice', { hasText: '🏥' }).click()
await page.waitForTimeout(400)
check('图标渲染出 🏥', (await page.locator('.st-wrap.selected .st-emoji').innerText()).includes('🏥'))
// 还原为默认圆点（验证可清除自定义图标，此选项会关闭菜单）
await page.locator('.icon-picker .icon-choice:has(.icon-dot-default)').click()
await page.waitForTimeout(300)
check('可还原为默认圆点', (await page.locator('.st-wrap.selected .st-dot').count()) === 1)
// 再设回图标（保持全部站点有图标，便于后续断言）
await page.locator('.icon-pick-btn').click()
await page.waitForSelector('.icon-picker')
await page.locator('.icon-picker .icon-choice', { hasText: '🏥' }).click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${SHOTS}/nf-3-icon.png` })
// 关闭图标菜单：它浮在选中栏上方，会遮挡后续出口编辑按钮（旋转/删除）
await page.locator('.icon-pick-btn').click()
await page.waitForTimeout(300)
check('图标菜单可关闭（不再遮挡出口编辑）', !(await page.locator('.icon-picker').isVisible().catch(() => false)))

console.log('6. 出口与出口编号')
await page.getByRole('button', { name: /＋ 出口/ }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /＋ 出口/ }).click()
await page.waitForTimeout(250)
const chipCount = await page.locator('.exit-chip').count()
check(`添加了 2 个出口（实际 ${chipCount}）`, chipCount === 2)
const l0 = await page.locator('.exit-label-input').nth(0).inputValue()
const l1 = await page.locator('.exit-label-input').nth(1).inputValue()
check(`出口默认编号 A / B（实际 ${l0}/${l1}）`, l0 === 'A' && l1 === 'B')
// 改第一个出口编号为「北」
await page.locator('.exit-label-input').first().fill('北')
await page.waitForTimeout(200)
const edited = await page.locator('.exit-label-input').first().inputValue()
check('出口编号可编辑为「北」', edited === '北')
await page.waitForTimeout(300)
const mapExits = await page.locator('.st-exit').count()
check(`地图上渲染 2 个出口标记（实际 ${mapExits}）`, mapExits === 2)
await page.screenshot({ path: `${SHOTS}/nf-4-exits.png` })

console.log('6b. 出口方向可调')
await page.locator('.exit-rotate').first().click()
await page.waitForTimeout(300)
await page.waitForTimeout(1200) // 等自动保存落盘
const exitAngle = await page.evaluate(async () => {
  const wid = location.hash.match(/#\/editor\/(.+)/)?.[1]
  const db = await new Promise((res, rej) => { const o = indexedDB.open('metro-designer'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error) })
  const rec = await new Promise((res, rej) => { const t = db.transaction('works', 'readonly'); const r = t.objectStore('works').get('md:work:' + wid); r.onsuccess = () => res(r.result); r.onerror = () => rej(o.error) })
  const st = Object.values(rec?.stations ?? {}).find((s) => (s.exits ?? []).length >= 2)
  return st?.exits?.[0]?.angle ?? null
})
check(`出口方向可调整（实际角度 ${exitAngle}）`, exitAngle === 15)

// 收起选中栏，避免影响后续点击
await page.locator('.selection-bar .btn', { hasText: '✖️' }).last().click()
await page.waitForTimeout(200)

console.log('5. 换乘站编辑')
await page.getByRole('button', { name: /新线路/ }).click()
await page.waitForTimeout(300)
check('出现 2号线', await page.getByText('2号线').first().isVisible())
// 在远离处放第 1 站
await page.mouse.click(cx - 240, cy + 230)
await page.waitForTimeout(200)
// 在带图标的 S0 上点一下（draw 模式下）→ 吸附成换乘
await page.locator('.st-icon').first().click()
await page.waitForTimeout(400)
const transferMarkers = await page.locator('.st-icon.transfer, .st-dot.transfer').count()
check(`形成 1 个换乘站（实际 ${transferMarkers}）`, transferMarkers >= 1)
// 选中换乘站
await page.getByRole('button', { name: /调整/ }).click()
await page.waitForTimeout(150)
await page.locator('.st-icon.transfer, .st-dot.transfer').first().click()
await page.waitForSelector('.transfer-badge', { timeout: 3000 })
const badgeTxt = await page.locator('.transfer-badge').innerText()
check(`换乘徽标显示 ×2（实际「${badgeTxt}」）`, badgeTxt.includes('×2'))
const chipN = await page.locator('.transfer-line-chip').count()
check(`展示所属 2 条线路 chip（实际 ${chipN}）`, chipN === 2)
await page.screenshot({ path: `${SHOTS}/nf-5-transfer.png` })
// 从一条线移出 → 不再是换乘
await page.locator('.transfer-line-chip .chip-remove').first().click()
await page.waitForTimeout(300)
const badgeAfter = await page.locator('.transfer-badge').count()
check('移出一条线后不再是换乘站', badgeAfter === 0)
const chipAfter = await page.locator('.transfer-line-chip').count()
check('移出后不再显示线路 chip', chipAfter === 0)

console.log('5b. 站间地上/地下：点地图段单独切换')
const segBefore = await page.evaluate(async () => {
  const wid = location.hash.match(/#\/editor\/(.+)/)?.[1]
  const db = await new Promise((res, rej) => { const o = indexedDB.open('metro-designer'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error) })
  const rec = await new Promise((res, rej) => { const t = db.transaction('works', 'readonly'); const r = t.objectStore('works').get('md:work:' + wid); r.onsuccess = () => res(r.result); r.onerror = () => rej(o.error) })
  const line = (rec?.lines ?? []).find((l) => l.name === '1号线')
  return line?.segmentGround ?? {}
})
// 在「调整」模式点两个站之间的线段中点 → 仅该段切换为地下（不是整条线一刀切）
await page.getByRole('button', { name: /调整/ }).click()
await page.waitForTimeout(200)
await page.mouse.click((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2)
await page.waitForTimeout(300)
await page.waitForTimeout(1200)
const segAfter = await page.evaluate(async () => {
  const wid = location.hash.match(/#\/editor\/(.+)/)?.[1]
  const db = await new Promise((res, rej) => { const o = indexedDB.open('metro-designer'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error) })
  const rec = await new Promise((res, rej) => { const t = db.transaction('works', 'readonly'); const r = t.objectStore('works').get('md:work:' + wid); r.onsuccess = () => res(r.result); r.onerror = () => rej(o.error) })
  const line = (rec?.lines ?? []).find((l) => l.name === '1号线')
  return line?.segmentGround ?? {}
})
const segKeys = Object.keys(segAfter)
check('点地图段后恰好多出 1 个分段设置（非整条线）', segKeys.length === Object.keys(segBefore).length + 1)
check('被点击的段切为地下', segKeys.length > 0 && segAfter[segKeys[0]] === 'under')

console.log('2a. 自动保存状态 + 刷新不丢')
await page.waitForTimeout(1600) // 等 1s 防抖落盘
const saveTxt = await page.locator('.save-status').innerText()
check(`保存状态显示「已保存」（实际「${saveTxt}」）`, saveTxt.includes('已保存'))
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
await page.waitForTimeout(2500)
const afterReload = await page.locator('.station-marker').count()
check(`刷新后站点仍在（实际 ${afterReload}，期望 7）`, afterReload === 7)
const iconAfter = await page.locator('.st-icon').count()
check(`刷新后图标仍在（实际 ${iconAfter}，期望 7）`, iconAfter === 7)
const exitAfter = await page.locator('.st-exit').count()
check(`刷新后出口仍在（实际 ${exitAfter}）`, exitAfter === 2)
await page.screenshot({ path: `${SHOTS}/nf-6-persist.png` })

console.log('3. 平板端布局（820×1180）不重叠')
await page.setViewportSize({ width: 820, height: 1180 })
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
await page.waitForTimeout(1800)
if ((await page.locator('.panel-tab-toolbar').count()) > 0)
  await page.locator('.panel-tab-toolbar').click()
if ((await page.locator('.panel-tab-lines').count()) > 0)
  await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(300)
// 开一条线跑车，让底部列车控制出现，验证与选中栏不重叠
await src('1号线').click()
await src('1号线').locator('button[title*="列车"]').first().click()
await page.waitForTimeout(800)
check('平板端列车控制可见', await page.locator('.train-controls').isVisible())
// 选中一个站点，让选中栏出现
await page.getByRole('button', { name: /调整/ }).click()
await page.waitForTimeout(150)
await page.locator('.station-marker').first().click()
await page.waitForSelector('.selection-bar', { timeout: 3000 })
await page.waitForTimeout(300)

const vw = 820
const vh = 1180
const tb = await boxOf('.toolbar')
const lp = await boxOf('.line-panel')
const sb = await boxOf('.selection-bar')
const tc = await boxOf('.train-controls')
const modeBtn = await page.locator('.mode-btn').first().boundingBox()

const within = (b) => b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vw + 1 && b.y + b.height <= vh + 1
check('工具栏在视口内不溢出', within(tb))
check('线路面板在视口内不溢出', within(lp))
check('选中栏在视口内不溢出', within(sb))
check('列车控制在视口内不溢出', within(tc))
// 线路面板在工具栏下方（不重叠）
check('线路面板不压住工具栏', lp && tb && lp.y >= tb.y + tb.height - 2)
// 选中栏在列车控制上方（不重叠）
check('选中栏不压住列车控制', sb && tc && sb.y + sb.height <= tc.y + 2)
// 触控目标够大
check(`模式按钮高度≥40px（实际 ${modeBtn?.height?.toFixed?.(0)}）`, modeBtn && modeBtn.height >= 40)
await page.screenshot({ path: `${SHOTS}/nf-7-tablet.png`, fullPage: false })

console.log('2b. 旧版本数据前向迁移（schemaVersion 1 → 2）')
const id = workId()
check('能解析到作品 id', Boolean(id))
if (id) {
  // 读取当前持久化记录 → 改写为 v1 形态（无 schemaVersion / 无 exits）→ 写回
  const mutated = await page.evaluate(async (wid) => {
    const key = 'md:work:' + wid
    const db = await new Promise((res, rej) => {
      const o = indexedDB.open('metro-designer')
      o.onsuccess = () => res(o.result)
      o.onerror = () => rej(o.error)
    })
    const tx = db.transaction('works', 'readwrite')
    const store = tx.objectStore('works')
    const rec = await new Promise((res, rej) => {
      const r = store.get(key)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    if (!rec) return { ok: false, reason: 'no record' }
    delete rec.schemaVersion
    for (const st of Object.values(rec.stations)) delete st.exits
    await new Promise((res, rej) => {
      const r = store.put(rec, key)
      r.onsuccess = () => res()
      r.onerror = () => rej(r.error)
    })
    return { ok: true }
  }, id)
  check('已把作品改写为 v1 形态并写回 IndexedDB', mutated.ok === true)

  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.map-canvas', { timeout: 8000 })
  await page.waitForTimeout(2000) // 等加载 + 自动保存落盘
  const markersAfter = await page.locator('.station-marker').count()
  check(`迁移后仍能渲染全部站点（实际 ${markersAfter}，期望 7）`, markersAfter === 7)
  const migrated = await page.evaluate(async (wid) => {
    const key = 'md:work:' + wid
    const db = await new Promise((res, rej) => {
      const o = indexedDB.open('metro-designer')
      o.onsuccess = () => res(o.result)
      o.onerror = () => rej(o.error)
    })
    const tx = db.transaction('works', 'readonly')
    const rec = await new Promise((res, rej) => {
      const r = tx.objectStore('works').get(key)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    if (!rec) return { ok: false }
    const bad = Object.values(rec.stations).filter(
      (s) => !Array.isArray(s.exits),
    ).length
    return { ok: true, schemaVersion: rec.schemaVersion, badExits: bad }
  }, id)
  check('迁移后 schemaVersion === 2', migrated.schemaVersion === 2)
  check(`迁移后每个站点都有 exits 数组（异常 ${migrated.badExits ?? '?'}，期望 0）`, migrated.badExits === 0)
  await page.screenshot({ path: `${SHOTS}/nf-8-migrate.png` })
}

await browser.close()

console.log('\n========== 新功能测试结果 ==========')
console.log(`通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) console.log('失败项：', failed)
const realErrors = errors.filter(
  (e) =>
    !e.includes('tile') &&
    !e.includes('net::ERR') &&
    !e.includes('favicon'),
)
if (realErrors.length) {
  console.log('控制台错误：')
  realErrors.forEach((e) => console.log('  -', e.slice(0, 200)))
}
process.exit(failed.length || realErrors.length ? 1 : 0)
