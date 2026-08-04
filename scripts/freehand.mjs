import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:5173'
const EXE = 'C:/Users/wythe/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'
const check = (name, cond) => {
  console.log(`${cond ? '✅' : '❌'} ${name}`)
  if (!cond) process.exitCode = 1
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

const workId = () => page.url().match(/#\/editor\/(.+)/)?.[1] ?? null
const readWork = () =>
  page.evaluate(async (id) => {
    const open = indexedDB.open('metro-designer')
    const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error) })
    const tx = db.transaction('works', 'readonly')
    const val = await new Promise((res, rej) => {
      const r = tx.objectStore('works').get('md:work:' + id)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    return val
  }, workId())

console.log('0. 新建作品')
await page.goto(BASE, { waitUntil: 'load' })
await page.getByRole('button', { name: /新建地铁图/ }).click()
await page.locator('.dialog-input').first().fill('画笔连入线路验证')
await page.getByRole('button', { name: /开始创作/ }).click()
await page.waitForURL(/#\/editor\//, { timeout: 8000 })
await page.waitForSelector('.map-canvas', { timeout: 8000 })
await page.waitForTimeout(2500)
if ((await page.locator('.panel-tab-toolbar').count()) > 0) await page.locator('.panel-tab-toolbar').click()
await page.waitForTimeout(300)

const mapBox = await page.locator('.map-canvas').boundingBox()
const cx = mapBox.x + mapBox.width / 2
const cy = mapBox.y + mapBox.height / 2
const sA = [cx - 180, cy - 120]
const sB = [cx + 180, cy + 100]

console.log('1. 画线模式放 2 个站')
await page.getByRole('button', { name: /✏️ 画线/ }).click()
await page.waitForTimeout(200)
await page.mouse.click(sA[0], sA[1]); await page.waitForTimeout(200)
await page.mouse.click(sB[0], sB[1]); await page.waitForTimeout(400)
const stCount = await page.locator('.station-marker').count()
check(`放出 2 个站点（实际 ${stCount}）`, stCount === 2)

console.log('2. 画笔：两端压在已有相邻站上 → 连入线路（不重复画线、线路保存笔迹路径）')
await page.getByRole('button', { name: /🖌️ 画笔/ }).click()
await page.waitForTimeout(200)
await page.mouse.move(sA[0], sA[1])
await page.mouse.down()
await page.mouse.move((sA[0] + sB[0]) / 2, Math.min(sA[1], sB[1]) - 160)
await page.mouse.move(sB[0], sB[1])
await page.mouse.up()
await page.waitForTimeout(1500)
let w = await readWork()
let fhs = w.freehands || []
const line = w.lines[0]
const segPaths = line.segmentPaths || {}
check('画笔连入线路后【不】额外生成独立画笔笔迹（freehands 仍为 0）', fhs.length === 0)
check('线路已记录该区间的手绘路径（segmentPaths 有 1 条）', Object.keys(segPaths).length === 1)
check('站数仍 2（吸附未新建站）', Object.keys(w.stations).length === 2)
const sp0 = segPaths[0]
const aId = line.stationIds[0], bId = line.stationIds[1]
const a = w.stations[aId], b = w.stations[bId]
check('手绘路径起点对齐到 A 站', !!sp0 && Math.abs(sp0[0].lat - a.lat) < 1e-6 && Math.abs(sp0[0].lng - a.lng) < 1e-6)
check('手绘路径终点对齐到 B 站', !!sp0 && Math.abs(sp0[sp0.length - 1].lat - b.lat) < 1e-6 && Math.abs(sp0[sp0.length - 1].lng - b.lng) < 1e-6)
check('手绘路径有弧度（中点明显偏离直线）', (() => {
  if (!sp0 || sp0.length < 3) return false
  const mid = sp0[Math.floor(sp0.length / 2)]
  const dx = b.lng - a.lng, dy = b.lat - a.lat
  const len = Math.hypot(dx, dy) || 1
  const proj = ((mid.lng - a.lng) * dx + (mid.lat - a.lat) * dy) / (len * len)
  const px = a.lng + proj * dx, py = a.lat + proj * dy
  return Math.hypot(mid.lng - px, mid.lat - py) > 0.0005
})())

console.log('3. 画笔：空白处起笔/收笔 → 自动建起/终点站并连入线路（整体仍是 1 条线）')
const blank = [mapBox.x + mapBox.width - 60, mapBox.y + 60]
await page.mouse.move(blank[0], blank[1])
await page.mouse.down()
await page.mouse.move(blank[0] - 80, blank[1] + 80)
await page.mouse.move(blank[0] - 160, blank[1] + 160)
await page.mouse.up()
await page.waitForTimeout(1500)
w = await readWork()
fhs = w.freehands || []
const line2 = w.lines[0]
const segPaths2 = line2.segmentPaths || {}
check('整段过程【未】产生独立画笔笔迹（freehands 仍 0）', fhs.length === 0)
check('又新增 1 段手绘路径（共 2 段）', Object.keys(segPaths2).length === 2)
check('空白起笔/收笔自动建起+终点站（站数 2→4）', Object.keys(w.stations).length === 4)
const allLineStations = new Set(line2.stationIds)
const newStations = Object.keys(w.stations).filter((id) => !line.stationIds.includes(id))
check('新建站已计入线路（不悬空）', newStations.length === 2 && newStations.every((id) => allLineStations.has(id)))

console.log('4. 控制台无错误')
check('无控制台错误', errors.length === 0)
if (errors.length) console.log('   errors:', errors.slice(0, 5))

await browser.close()
console.log('DONE')
