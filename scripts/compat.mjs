/**
 * 兼容性回归测试：验证「老版本本地已保存作品」在更新后不会丢线 / 显示错乱。
 *
 * 模拟一份 v1 形态的老数据（无 schemaVersion / 无 exits / 无 segmentPaths / 含旧画笔笔迹），
 * 注入 IndexedDB 后：
 *   1) 加载后能渲染全部线路与站点（不丢线）
 *   2) 旧画笔笔迹（含连入相邻两站的装饰线）被完整保留，且不被静默改写成 segmentPaths
 *   3) 迁移后 schemaVersion 升到 2、每个站点补齐 exits 数组
 *   4) 刷新页面后（自动保存往返）数据依然完好，不丢线、不丢笔迹
 *
 * 用法：node scripts/compat.mjs
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

const wid = 'compat-old-001'

// 构造一份「老版本 v1」作品（无 schemaVersion、无 exits、无 segmentPaths，含旧画笔笔迹）
const oldWork = {
  id: wid,
  name: '老版本兼容测试图',
  cityKey: 'beijing',
  view: { lat: 39.91, lng: 116.3, zoom: 10 },
  stations: {
    s0: { id: 's0', name: '苹果园', lat: 39.94, lng: 116.1, icon: '🍎' },
    s1: { id: 's1', name: '古城', lat: 39.91, lng: 116.18, icon: '🏯' },
    s2: { id: 's2', name: '复兴门', lat: 39.907, lng: 116.36, icon: '🏦' }, // 换乘站
    s3: { id: 's3', name: '建国门', lat: 39.908, lng: 116.43, icon: '🏢' },
    s4: { id: 's4', name: '西直门', lat: 39.94, lng: 116.35, icon: '🚉' },
    s5: { id: 's5', name: '东直门', lat: 39.94, lng: 116.43, icon: '🚌' },
    s6: { id: 's6', name: '装饰站', lat: 39.86, lng: 116.3, icon: '🌳' },
  },
  lines: [
    {
      id: 'L1',
      name: '1号线',
      color: '#E60012',
      stationIds: ['s0', 's1', 's2', 's3'],
      visible: true,
      train: { enabled: false, speed: 2, mode: 'pingpong' },
    },
    {
      id: 'L2',
      name: '2号线',
      color: '#005BAC',
      stationIds: ['s4', 's2', 's5'],
      visible: true,
      train: { enabled: false, speed: 2, mode: 'pingpong' },
    },
  ],
  stickers: [],
  // 旧画笔笔迹：fh1 连在 1 号线相邻两站 s0→s1（旧版画笔的装饰线）；fh2 空白区涂鸦
  freehands: [
    {
      id: 'fh1',
      color: '#E60012',
      points: [
        { lat: 39.94, lng: 116.1 },
        { lat: 39.93, lng: 116.14 },
        { lat: 39.91, lng: 116.18 },
      ],
      width: 2,
      startStationId: 's0',
      endStationId: 's1',
    },
    {
      id: 'fh2',
      color: '#005BAC',
      points: [
        { lat: 39.86, lng: 116.28 },
        { lat: 39.85, lng: 116.32 },
      ],
      width: 2,
    },
  ],
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  // 注意：故意不带 schemaVersion / exits / segmentPaths，模拟老数据
}

console.log('0. 启动应用，确保 IndexedDB 已就绪')
await page.goto(BASE, { waitUntil: 'load' })
await page.waitForTimeout(1500)

console.log('1. 注入老版本 v1 作品到 IndexedDB')
const seeded = await page.evaluate(
  async ({ work, id }) => {
    const db = await new Promise((res, rej) => {
      const o = indexedDB.open('metro-designer', 2)
      o.onupgradeneeded = () => o.result.createObjectStore('works')
      o.onsuccess = () => res(o.result)
      o.onerror = () => rej(o.error)
    })
    await new Promise((res, rej) => {
      const tx = db.transaction('works', 'readwrite')
      tx.objectStore('works').put(work, 'md:work:' + id)
      tx.objectStore('works').put(
        [
          {
            id,
            name: work.name,
            updatedAt: work.updatedAt,
            lineCount: work.lines.length,
            stationCount: Object.keys(work.stations).length,
          },
        ],
        'md:index',
      )
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    return { ok: true }
  },
  { work: oldWork, id: wid },
)
check('已注入老版本作品到 IndexedDB', seeded.ok === true)

console.log('2. 打开老作品，验证不丢线 / 不丢笔迹')
await page.goto(`${BASE}/#/editor/${wid}`, { waitUntil: 'load' })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
// 展开线路面板（默认收起），否则 .line-card 不渲染
if ((await page.locator('.panel-tab-lines').count()) > 0)
  await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(2500) // 等瓦片 + 自动保存落盘

const lineCards = await page.locator('.line-card').count()
check(`线路卡片数应为 2（实际 ${lineCards}）`, lineCards === 2)
const markers = await page.locator('.station-marker').count()
check(`站点标记数应为 7（实际 ${markers}）`, markers === 7)
const transfer = await page.locator('.st-icon.transfer, .st-dot.transfer').count()
check(`换乘站应被识别（实际 ${transfer}）`, transfer >= 1)

const afterLoad = await page.evaluate(async (id) => {
  const db = await new Promise((res, rej) => {
    const o = indexedDB.open('metro-designer', 2)
    o.onsuccess = () => res(o.result)
    o.onerror = () => rej(o.error)
  })
  const rec = await new Promise((res, rej) => {
    const t = db.transaction('works', 'readonly')
    const r = t.objectStore('works').get('md:work:' + id)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  if (!rec) return { ok: false }
  const badExits = Object.values(rec.stations).filter((s) => !Array.isArray(s.exits)).length
  const l1 = rec.lines.find((l) => l.id === 'L1')
  const l2 = rec.lines.find((l) => l.id === 'L2')
  return {
    ok: true,
    schemaVersion: rec.schemaVersion,
    badExits,
    lineCount: rec.lines.length,
    stationCount: Object.keys(rec.stations).length,
    freehandCount: (rec.freehands ?? []).length,
    // 关键：旧画笔不应被静默改写成 segmentPaths
    l1HasSegmentPaths: Boolean(l1 && l1.segmentPaths && Object.keys(l1.segmentPaths).length),
    // 旧画笔的起点/终点站引用应保留
    fh1Start: rec.freehands?.[0]?.startStationId,
    fh1End: rec.freehands?.[0]?.endStationId,
    l1StationCount: l1?.stationIds?.length,
    l2StationCount: l2?.stationIds?.length,
  }
}, wid)

check('迁移后 schemaVersion === 3', afterLoad.schemaVersion === 3)
check(`每个站点都补齐 exits 数组（异常 ${afterLoad.badExits}）`, afterLoad.badExits === 0)
check(`线路数仍为 2（实际 ${afterLoad.lineCount}）`, afterLoad.lineCount === 2)
check(`站点数仍为 7（实际 ${afterLoad.stationCount}）`, afterLoad.stationCount === 7)
check(`旧画笔笔迹保留 2 条（实际 ${afterLoad.freehandCount}）`, afterLoad.freehandCount === 2)
check('连入相邻站的旧画笔未被静默改写成 segmentPaths', afterLoad.l1HasSegmentPaths === false)
check('旧画笔起点站引用保留 (s0)', afterLoad.fh1Start === 's0')
check('旧画笔终点站引用保留 (s1)', afterLoad.fh1End === 's1')
check(`1号线站点序列完整 (${afterLoad.l1StationCount})`, afterLoad.l1StationCount === 4)
check(`2号线站点序列完整 (${afterLoad.l2StationCount})`, afterLoad.l2StationCount === 3)

const realErrors = errors.filter(
  (e) => !e.includes('tile') && !e.includes('net::ERR') && !e.includes('favicon'),
)
check(`加载过程无控制台报错（实际 ${realErrors.length}）`, realErrors.length === 0)
await page.screenshot({ path: `${SHOTS}/compat-1-loaded.png` })

console.log('3. 刷新页面（自动保存往返），验证数据依然完好')
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
if ((await page.locator('.panel-tab-lines').count()) > 0)
  await page.locator('.panel-tab-lines').click()
await page.waitForTimeout(2500)

const lineCards2 = await page.locator('.line-card').count()
check(`刷新后线路卡片数仍为 2（实际 ${lineCards2}）`, lineCards2 === 2)
const markers2 = await page.locator('.station-marker').count()
check(`刷新后站点标记数仍为 7（实际 ${markers2}）`, markers2 === 7)

const afterReload = await page.evaluate(async (id) => {
  const db = await new Promise((res, rej) => {
    const o = indexedDB.open('metro-designer', 2)
    o.onsuccess = () => res(o.result)
    o.onerror = () => rej(o.error)
  })
  const rec = await new Promise((res, rej) => {
    const t = db.transaction('works', 'readonly')
    const r = t.objectStore('works').get('md:work:' + id)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  return {
    lineCount: rec?.lines?.length,
    stationCount: rec ? Object.keys(rec.stations).length : 0,
    freehandCount: rec?.freehands?.length ?? 0,
    l1HasSegmentPaths: Boolean(rec?.lines?.find((l) => l.id === 'L1')?.segmentPaths),
  }
}, wid)
check(`刷新后线路数仍为 2（实际 ${afterReload.lineCount}）`, afterReload.lineCount === 2)
check(`刷新后站点数仍为 7（实际 ${afterReload.stationCount}）`, afterReload.stationCount === 7)
check(`刷新后旧画笔仍保留 2 条（实际 ${afterReload.freehandCount}）`, afterReload.freehandCount === 2)
check('刷新后连入相邻站的旧画笔仍未被改写成 segmentPaths', afterReload.l1HasSegmentPaths === false)
await page.screenshot({ path: `${SHOTS}/compat-2-reloaded.png` })

await browser.close()

console.log('\n========== 兼容性测试结果 ==========')
console.log(`通过 ${passed} 项，失败 ${failed.length} 项`)
if (failed.length) console.log('失败项：', failed)
const finalErrors = errors.filter(
  (e) => !e.includes('tile') && !e.includes('net::ERR') && !e.includes('favicon'),
)
if (finalErrors.length) {
  console.log('控制台错误：')
  finalErrors.forEach((e) => console.log('  -', e.slice(0, 200)))
}
process.exit(failed.length || finalErrors.length ? 1 : 0)
