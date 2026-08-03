import localforage from 'localforage'
import type { Work, WorkIndexItem } from '../model/types'
import { normalizeWork } from '../model/factory'
import { useWorkStore } from './workStore'
import { useUIStore } from './uiStore'
import { exportWorkToSVG } from '../export/renderSVG'
import { svgToPngDataUrl } from '../export/svgToPng'

const INDEX_KEY = 'md:index'
const WORK_PREFIX = 'md:work:'

localforage.config({ name: 'metro-designer', storeName: 'works' })

export async function loadIndex(): Promise<WorkIndexItem[]> {
  const idx = await localforage.getItem<WorkIndexItem[]>(INDEX_KEY)
  return (idx ?? []).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadWork(id: string): Promise<Work | null> {
  const work = await localforage.getItem<Work>(WORK_PREFIX + id)
  return work ? normalizeWork(work) : null
}

async function writeIndex(update: (items: WorkIndexItem[]) => WorkIndexItem[]): Promise<void> {
  const items = await localforage.getItem<WorkIndexItem[]>(INDEX_KEY)
  await localforage.setItem(INDEX_KEY, update(items ?? []))
}

async function makeThumbnail(work: Work): Promise<string | undefined> {
  try {
    const { svg, width, height } = exportWorkToSVG(work, {
      background: 'white',
      showTitle: false,
      showLegend: false,
    })
    return await svgToPngDataUrl(svg, width, height, 360)
  } catch (err) {
    console.warn('缩略图生成失败（不影响保存）', err)
    return undefined // 缩略图失败不阻塞保存
  }
}

/** 立即保存作品 + 更新画廊索引（含缩略图） */
export async function saveWorkNow(work: Work): Promise<void> {
  await localforage.setItem(WORK_PREFIX + work.id, work)
  const thumbnail = await makeThumbnail(work)
  await writeIndex((items) => {
    const prev = items.find((i) => i.id === work.id)
    const rest = items.filter((i) => i.id !== work.id)
    const item: WorkIndexItem = {
      id: work.id,
      name: work.name,
      updatedAt: work.updatedAt,
      lineCount: work.lines.length,
      stationCount: Object.keys(work.stations).length,
      thumbnail: thumbnail ?? prev?.thumbnail,
    }
    return [item, ...rest]
  })
}

/** 写入/覆盖一个作品（导入、复制用），不经过 store */
export async function putWork(work: Work): Promise<void> {
  await saveWorkNow(work)
}

export async function removeWork(id: string): Promise<void> {
  await localforage.removeItem(WORK_PREFIX + id)
  await writeIndex((items) => items.filter((i) => i.id !== id))
}

/** 挂载自动保存：work 变化后 1s 防抖落盘；关闭/刷新页面时立即落盘，绝不丢失。返回解绑函数。 */
export function attachAutosave(): () => void {
  const setStatus = (s: 'saving' | 'saved') => useUIStore.getState().setSaveStatus(s)
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let latest: Work | null = useWorkStore.getState().work
  let dirty = false

  const flush = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (latest) void saveWorkNow(latest)
    dirty = false
  }

  const schedule = (work: Work) => {
    latest = work
    dirty = true
    setStatus('saving')
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void saveWorkNow(work).then(() => setStatus('saved'))
      saveTimer = null
      dirty = false
    }, 1000)
  }

  const unsub = useWorkStore.subscribe((state) => {
    if (state.work && state.work !== latest) {
      schedule(state.work)
    } else if (!state.work) {
      latest = null
    }
  })

  // 关闭 / 刷新 / 切后台时立即落盘，堵住「防抖窗口内丢失」的漏洞
  const onHide = () => {
    if (dirty) flush()
  }
  window.addEventListener('beforeunload', onHide)
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide()
  })

  return () => {
    unsub()
    window.removeEventListener('beforeunload', onHide)
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onHide)
  }
}
