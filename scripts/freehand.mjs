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
await page.locator('.dialog-input').first().fill('画笔吸附验证')
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

console.log('2. 画笔：两端压在已有站上 → 吸附（不新建站）')
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
const fhA = fhs[fhs.length - 1]
check('已生成 1 条笔迹', fhs.length === 1)
check('起点吸附到站点（startStationId 非 null）', !!fhA?.startStationId)
check('终点吸附到站点（endStationId 非 null）', !!fhA?.endStationId)
check('吸附未新建站（站数仍 2）', Object.keys(w.stations).length === 2)

console.log('3. 画笔：空白处起笔/收笔 → 自动建起/终点站')
const blank = [mapBox.x + mapBox.width - 60, mapBox.y + 60]
await page.mouse.move(blank[0], blank[1])
await page.mouse.down()
await page.mouse.move(blank[0] - 80, blank[1] + 80)
await page.mouse.move(blank[0] - 160, blank[1] + 160)
await page.mouse.up()
await page.waitForTimeout(1500)
w = await readWork()
fhs = w.freehands || []
const fhB = fhs[fhs.length - 1]
check('已生成第 2 条笔迹', fhs.length === 2)
check('空白起笔 → 自动建起点站（startStationId 非 null）', !!fhB?.startStationId)
check('空白收笔 → 自动建终点站（endStationId 非 null）', !!fhB?.endStationId)
check('自动建起+终点站（站数 2→4）', Object.keys(w.stations).length === 4)
const allLineStations = new Set(w.lines.flatMap((l) => l.stationIds))
check('新建站已计入线路（不悬空）', !!fhB && allLineStations.has(fhB.startStationId) && allLineStations.has(fhB.endStationId))

console.log('4. 控制台无错误')
check('无控制台错误', errors.length === 0)
if (errors.length) console.log('   errors:', errors.slice(0, 5))

await browser.close()
console.log('DONE')
