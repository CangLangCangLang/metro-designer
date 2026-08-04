/**
 * 运营时刻功能回归测试：
 *   1) 每个站间区间显示行车时长（距离 ÷ 该段时速）
 *   2) 每站显示首班车到达时刻，且严格递增
 *   3) 线路卡片摘要 + 详情底部显示全程时长（含停站）
 *   4) 首班车 / 末班车可设置、影响时刻推算、可持久化
 *   5) 每站停车时长档位可切换，并计入全程时长
 *   6) 导出 SVG 图例带上全程时长与首末班车
 * 用法：node scripts/timetable.mjs
 * 前提：dev server 已在 http://localhost:5173 运行
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const EXE = 'C:/Users/wythe/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'

const errors = []
const failed = []
let passed = 0
const check = (name, cond) => {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed.push(name)
    console.log(`  ❌ ${name}`)
  }
}

/* ---------- 在 node 侧独立复现一遍算法，用来校验 UI 的数字 ---------- */
const EARTH_R = 6371000
function distanceMeters(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h =
    s1 * s1 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)))
}
const fmtHHMM = (minutes) => {
  const t = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const parseHHMM = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim())
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
}
/** 依据持久化数据算出 [每段分钟数, 每站累计偏移分钟] */
function calcFromWork(work) {
  const line = work.lines[0]
  const stops = line.stationIds.map((id) => work.stations[id])
  const segMin = []
  for (let i = 0; i < stops.length - 1; i++) {
    const kmh = line.segmentSpeeds?.[i] ?? line.speedKmh ?? 80
    segMin.push((distanceMeters(stops[i], stops[i + 1]) / 1000 / kmh) * 60)
  }
  const dwellMin = (typeof line.dwellSeconds === 'number' ? line.dwellSeconds : 30) / 60
  const offsets = [0]
  let acc = 0
  for (let i = 0; i < segMin.length; i++) {
    if (i > 0) acc += dwellMin
    acc += segMin[i]
    offsets.push(acc)
  }
  return { line, stops, segMin, offsets, total: acc }
}

const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 940 } })
const downloads = []
page.on('download', (d) => downloads.push(d))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

const workId = () => page.url().match(/#\/editor\/(.+)/)?.[1] ?? null
const readWork = () =>
  page.evaluate(async (id) => {
    const open = indexedDB.open('metro-designer')
    const db = await new Promise((res, rej) => {
      open.onsuccess = () => res(open.result)
      open.onerror = () => rej(open.error)
    })
    const tx = db.transaction('works', 'readonly')
    return await new Promise((res, rej) => {
      const r = tx.objectStore('works').get('md:work:' + id)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }, workId())

console.log('0. 新建作品并放 3 个站')
await page.goto(BASE, { waitUntil: 'load' })
await page.getByRole('button', { name: /新建地铁图/ }).click()
await page.locator('.dialog-input').first().fill('时刻表验证')
await page.getByRole('button', { name: /开始创作/ }).click()
await page.waitForURL(/#\/editor\//, { timeout: 8000 })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
await page.waitForTimeout(2500)
if ((await page.locator('.panel-tab-toolbar').count()) > 0) await page.locator('.panel-tab-toolbar').click()
if ((await page.locator('.panel-tab-lines').count()) > 0) await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(300)

const box = await page.locator('.map-canvas').boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
await page.getByRole('button', { name: /✏️ 画线/ }).click()
await page.waitForTimeout(200)
for (const [dx, dy] of [[-260, -140], [-20, 20], [240, 150]]) {
  await page.mouse.click(cx + dx, cy + dy)
  await page.waitForTimeout(250)
}
check('放出 3 个站点', (await page.locator('.station-marker').count()) === 3)

console.log('1. 新线路默认带运营时刻字段')
await page.waitForTimeout(1200)
let w = await readWork()
check('线路默认 firstTrain = 06:00', w.lines[0].firstTrain === '06:00')
check('线路默认 lastTrain = 22:30', w.lines[0].lastTrain === '22:30')
check('线路默认 dwellSeconds = 30', w.lines[0].dwellSeconds === 30)
check('schemaVersion 已升到 3', w.schemaVersion === 3)

console.log('2. 卡片摘要显示全程时长')
const summary = (await page.locator('.line-detail-toggle').first().textContent()) || ''
check(`摘要含站数与里程（"${summary.trim()}"）`, /3站/.test(summary) && /(米|公里)/.test(summary))
check('摘要含全程时长（约 x 分钟）', /约\s*\d+\s*(分钟|小时)/.test(summary))

console.log('3. 展开详情：每段时长 + 每站到点时刻')
await page.locator('.line-detail-toggle').first().click()
await page.waitForTimeout(400)
const segMinCount = await page.locator('.seg-min').count()
const stTimeCount = await page.locator('.station-time').count()
check(`2 个区间各显示 1 个行车时长（实际 ${segMinCount}）`, segMinCount === 2)
check(`3 个站各显示 1 个到点时刻（实际 ${stTimeCount}）`, stTimeCount === 3)

w = await readWork()
let calc = calcFromWork(w)
const times = await page.locator('.station-time').allTextContents()
const expectTimes = calc.offsets.map((o) => fmtHHMM(360 + o))
check(`首站时刻 = 首班车 06:00（实际 ${times[0]}）`, times[0] === '06:00')
check(
  `各站到点时刻与距离/速度推算一致（UI ${times.join('/')} vs 计算 ${expectTimes.join('/')}）`,
  times.length === 3 && times.every((t, i) => t === expectTimes[i]),
)
const tMin = times.map(parseHHMM)
check('到点时刻严格递增', tMin[0] < tMin[1] && tMin[1] < tMin[2])

const segTexts = await page.locator('.seg-min').allTextContents()
check(
  `区间时长文本格式正确（"${segTexts.join('", "')}"）`,
  segTexts.length === 2 && segTexts.every((t) => /^\d+(分\d+秒|分钟|秒)$/.test(t.trim())),
)

console.log('4. 底部汇总：全程 = 行车 + 停站')
const tripText = (await page.locator('.trip-time').first().innerText()) || ''
check('显示「全程」总时长', /全程\s*约/.test(tripText))
check('显示行车时长明细', /行车/.test(tripText))
check('显示停站明细（1 站 × 30 秒）', /停站\s*1\s*站\s*×\s*30\s*秒/.test(tripText))
check('显示首班车发车→到终点', /首班车\s*06:00\s*发车/.test(tripText))
check('显示末班车发车→到终点', /末班车\s*22:30\s*发车/.test(tripText))
const lastArrive = fmtHHMM(parseHHMM('22:30') + calc.total)
check(`末班车到终点时刻推算正确（应含 ${lastArrive}）`, tripText.includes(lastArrive))

console.log('5. 修改首班车 → 时刻整体平移')
await page.locator('.time-input').first().fill('07:15')
await page.waitForTimeout(800)
const times2 = await page.locator('.station-time').allTextContents()
const expect2 = calc.offsets.map((o) => fmtHHMM(parseHHMM('07:15') + o))
check(`首站变为 07:15（实际 ${times2[0]}）`, times2[0] === '07:15')
check(`全部到点时刻按新首班车重算（${times2.join('/')}）`, times2.every((t, i) => t === expect2[i]))

console.log('6. 修改末班车 → 运营时长同步')
await page.locator('.time-input').nth(1).fill('23:45')
await page.waitForTimeout(800)
const opText = (await page.locator('.op-summary').first().innerText()) || ''
check(`运营时长显示 16 小时 30 分钟（实际 "${opText.trim()}"）`, /16\s*小时\s*30\s*分钟/.test(opText))
check('运营汇总同时显示单程时长', /单程/.test(opText))

console.log('7. 停站时长档位')
const dwellGroup = page.locator('.line-card-section .seg-group.speed-group').nth(1)
const dwellBtns = await dwellGroup.locator('.pill-btn').allTextContents()
check(`停站档位为 不停/20/30/45/60（实际 ${dwellBtns.join(',')}）`, dwellBtns.join(',') === '不停,20,30,45,60')
await dwellGroup.locator('.pill-btn', { hasText: /^60$/ }).click()
await page.waitForTimeout(1600) // 持久化防抖 1000ms，等其落盘
const tripText60 = (await page.locator('.trip-time').first().innerText()) || ''
check('切到 60 秒后停站明细更新', /停站\s*1\s*站\s*×\s*60\s*秒/.test(tripText60))
const on60 = await dwellGroup.locator('.pill-btn.pill-on').first().textContent()
check(`60 秒档位处于选中态（实际选中 "${(on60 || '').trim()}"）`, (on60 || '').trim() === '60')
w = await readWork()
check('停站时长已持久化 dwellSeconds = 60', w.lines[0].dwellSeconds === 60)
await dwellGroup.locator('.pill-btn', { hasText: /^不停$/ }).click()
await page.waitForTimeout(1600)
w = await readWork()
check('切到「不停」后 dwellSeconds = 0', w.lines[0].dwellSeconds === 0)
const tripNoDwell = (await page.locator('.trip-time').first().innerText()) || ''
check('「不停」时不再显示停站明细', !/停站/.test(tripNoDwell))
calc = calcFromWork(w)
const times3 = await page.locator('.station-time').allTextContents()
const expect3 = calc.offsets.map((o) => fmtHHMM(parseHHMM('07:15') + o))
check(`不停站时到点时刻按纯行车重算（${times3.join('/')}）`, times3.every((t, i) => t === expect3[i]))

console.log('8. 刷新后设置保留')
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
await page.waitForTimeout(2200)
if ((await page.locator('.panel-tab-lines').count()) > 0) await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(300)
w = await readWork()
check('刷新后 firstTrain 仍为 07:15', w.lines[0].firstTrain === '07:15')
check('刷新后 lastTrain 仍为 23:45', w.lines[0].lastTrain === '23:45')
check('刷新后 dwellSeconds 仍为 0', w.lines[0].dwellSeconds === 0)
check('刷新后线路与站点未丢失', w.lines.length === 1 && w.lines[0].stationIds.length === 3)
const firstInput = await page.locator('.time-input').first().inputValue()
check(`刷新后首班车输入框回显 07:15（实际 ${firstInput}）`, firstInput === '07:15')

console.log('9. 导出 SVG 图例带时刻信息')
await page.locator('.line-detail-toggle').first().click() // 收起详情，避免遮挡
await page.waitForTimeout(200)
const exportBtn = page.getByRole('button', { name: /导出/ }).first()
await exportBtn.click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: /SVG 矢量图/ }).click()
await page.waitForTimeout(2500)
check(`SVG 已下载（${downloads.length} 个文件）`, downloads.length >= 1)
if (downloads.length) {
  const p = await downloads[downloads.length - 1].path()
  const svg = readFileSync(p, 'utf8')
  check('SVG 图例含首班车时刻 07:15', svg.includes('首班 07:15'))
  check('SVG 图例含末班车时刻 23:45', svg.includes('末班 23:45'))
  check('SVG 图例含全程时长', /全程约\s*\d+\s*(分钟|小时)/.test(svg))
}

const realErrors = errors.filter(
  (e) => !/tile|openstreetmap|ERR_|Failed to load resource|net::/i.test(e),
)
check(`无控制台报错（实际 ${realErrors.length}）`, realErrors.length === 0)
if (realErrors.length) console.log(realErrors.slice(0, 5))

await browser.close()
console.log(`\n通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) {
  console.log('失败项：')
  failed.forEach((f) => console.log('  - ' + f))
  process.exitCode = 1
}
