import { create } from 'zustand'
import type { Line, Sticker, Work } from '../model/types'
import { cleanupOrphanStations } from '../model/transfer'
import {
  createFreehand,
  createLine,
  createStation,
  createSticker,
  nextLineColor,
  nextLineName,
} from '../model/factory'
import { newId } from '../utils/id'

const UNDO_LIMIT = 50

interface WorkStore {
  work: Work | null
  past: Work[]
  future: Work[]

  setWork(work: Work | null): void
  /** 所有作品数据修改的统一入口；undoable=false 时不记快照 */
  mutate(recipe: (w: Work) => Work, undoable?: boolean): void
  /** 拖拽开始时手动记一次快照（拖拽过程不重复记） */
  pushUndoSnapshot(): void
  undo(): void
  redo(): void

  // ---- 线路 ----
  addLine(): string
  renameLine(lineId: string, name: string): void
  setLineColor(lineId: string, color: string): void
  toggleLineVisible(lineId: string): void
  deleteLine(lineId: string): void
  setTrain(lineId: string, patch: Partial<Line['train']>): void
  /** 通用线路属性更新（线样式/路径模式/线路时速/区间时速等） */
  updateLine(
    lineId: string,
    patch: Partial<Pick<Line, 'style' | 'pathMode' | 'speedKmh' | 'segmentSpeeds'>>,
  ): void

  // ---- 站点 ----
  /** 向线路末尾追加站点；snapStationId 存在则复用已有站点（形成换乘）。返回站点 id */
  addStation(lineId: string, lat: number, lng: number, snapStationId?: string): string
  renameStation(stationId: string, name: string): void
  /** 拖拽结束移动站点；snapToLineId 存在时尝试吸附到该线路附近站点由调用方处理 */
  moveStation(stationId: string, lat: number, lng: number): void
  removeStationFromLine(lineId: string, stationId: string): void
  deleteStation(stationId: string): void

  // ---- 贴纸 ----
  addSticker(emoji: string, lat: number, lng: number): string
  updateSticker(id: string, patch: Partial<Sticker>): void
  deleteSticker(id: string): void

  // ---- 自由画笔 ----
  addFreehand(color: string, points: { lat: number; lng: number }[], width?: 1 | 2 | 3): string
  deleteFreehand(id: string): void

  // ---- 其他 ----
  setView(view: Work['view']): void
  renameWork(name: string): void
}

export const useWorkStore = create<WorkStore>((set, get) => ({
  work: null,
  past: [],
  future: [],

  setWork(work) {
    set({ work, past: [], future: [] })
  },

  mutate(recipe, undoable = true) {
    const { work, past } = get()
    if (!work) return
    const next = recipe(work)
    if (next === work) return
    next.updatedAt = Date.now()
    set({
      work: next,
      past: undoable ? [...past.slice(-(UNDO_LIMIT - 1)), structuredClone(work)] : past,
      future: [],
    })
  },

  pushUndoSnapshot() {
    const { work, past } = get()
    if (!work) return
    set({
      past: [...past.slice(-(UNDO_LIMIT - 1)), structuredClone(work)],
      future: [],
    })
  },

  undo() {
    const { work, past, future } = get()
    if (!work || past.length === 0) return
    const prev = past[past.length - 1]
    set({
      work: prev,
      past: past.slice(0, -1),
      future: [...future, structuredClone(work)],
    })
  },

  redo() {
    const { work, past, future } = get()
    if (!work || future.length === 0) return
    const next = future[future.length - 1]
    set({
      work: next,
      past: [...past, structuredClone(work)],
      future: future.slice(0, -1),
    })
  },

  // ---- 线路 ----

  addLine() {
    const line = createLine(
      nextLineName(get().work?.lines ?? []),
      nextLineColor(get().work?.lines ?? []),
    )
    get().mutate((w) => ({ ...w, lines: [...w.lines, line] }))
    return line.id
  },

  renameLine(lineId, name) {
    get().mutate((w) => ({
      ...w,
      lines: w.lines.map((l) => (l.id === lineId ? { ...l, name } : l)),
    }))
  },

  setLineColor(lineId, color) {
    get().mutate((w) => ({
      ...w,
      lines: w.lines.map((l) => (l.id === lineId ? { ...l, color } : l)),
    }))
  },

  toggleLineVisible(lineId) {
    get().mutate((w) => ({
      ...w,
      lines: w.lines.map((l) => (l.id === lineId ? { ...l, visible: !l.visible } : l)),
    }))
  },

  deleteLine(lineId) {
    get().mutate((w) =>
      cleanupOrphanStations({ ...w, lines: w.lines.filter((l) => l.id !== lineId) }),
    )
  },

  setTrain(lineId, patch) {
    // 列车配置入存档但不进撤销栈（表现层设置）
    get().mutate(
      (w) => ({
        ...w,
        lines: w.lines.map((l) =>
          l.id === lineId ? { ...l, train: { ...l.train, ...patch } } : l,
        ),
      }),
      false,
    )
  },

  updateLine(lineId, patch) {
    get().mutate((w) => ({
      ...w,
      lines: w.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }))
  },

  // ---- 站点 ----

  addStation(lineId, lat, lng, snapStationId) {
    const work = get().work
    if (!work) return ''
    if (snapStationId && work.stations[snapStationId]) {
      get().mutate((w) => ({
        ...w,
        lines: w.lines.map((l) =>
          l.id === lineId ? { ...l, stationIds: [...l.stationIds, snapStationId] } : l,
        ),
      }))
      return snapStationId
    }
    const seq = Object.keys(work.stations).length + 1
    const station = createStation(`车站${seq}`, lat, lng)
    get().mutate((w) => ({
      ...w,
      stations: { ...w.stations, [station.id]: station },
      lines: w.lines.map((l) =>
        l.id === lineId ? { ...l, stationIds: [...l.stationIds, station.id] } : l,
      ),
    }))
    return station.id
  },

  renameStation(stationId, name) {
    get().mutate((w) => {
      const st = w.stations[stationId]
      if (!st) return w
      return { ...w, stations: { ...w.stations, [stationId]: { ...st, name } } }
    })
  },

  moveStation(stationId, lat, lng) {
    get().mutate(
      (w) => {
        const st = w.stations[stationId]
        if (!st) return w
        return { ...w, stations: { ...w.stations, [stationId]: { ...st, lat, lng } } }
      },
      false, // 快照已在 dragstart 时记录
    )
  },

  removeStationFromLine(lineId, stationId) {
    get().mutate((w) =>
      cleanupOrphanStations({
        ...w,
        lines: w.lines.map((l) =>
          l.id === lineId ? { ...l, stationIds: l.stationIds.filter((id) => id !== stationId) } : l,
        ),
      }),
    )
  },

  deleteStation(stationId) {
    get().mutate((w) =>
      cleanupOrphanStations({
        ...w,
        lines: w.lines.map((l) => ({
          ...l,
          stationIds: l.stationIds.filter((id) => id !== stationId),
        })),
      }),
    )
  },

  // ---- 贴纸 ----

  addSticker(emoji, lat, lng) {
    const sticker = createSticker(emoji, lat, lng)
    get().mutate((w) => ({ ...w, stickers: [...w.stickers, sticker] }))
    return sticker.id
  },

  updateSticker(id, patch) {
    get().mutate(
      (w) => ({
        ...w,
        stickers: w.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }),
      false,
    )
  },

  deleteSticker(id) {
    get().mutate((w) => ({ ...w, stickers: w.stickers.filter((s) => s.id !== id) }))
  },

  // ---- 自由画笔 ----

  addFreehand(color, points, width = 2) {
    const stroke = createFreehand(color, points, width)
    get().mutate((w) => ({ ...w, freehands: [...(w.freehands ?? []), stroke] }))
    return stroke.id
  },

  deleteFreehand(id) {
    get().mutate((w) => ({
      ...w,
      freehands: (w.freehands ?? []).filter((f) => f.id !== id),
    }))
  },

  // ---- 其他 ----

  setView(view) {
    get().mutate((w) => ({ ...w, view }), false)
  },

  renameWork(name) {
    get().mutate((w) => ({ ...w, name }), false)
  },
}))

/** 供画廊复制作品：深拷贝并重新生成全部 id */
export function cloneWorkWithNewIds(work: Work, newName?: string): Work {
  const cloned: Work = structuredClone(work)
  cloned.id = newId()
  cloned.name = newName ?? `${work.name} 副本`
  cloned.createdAt = Date.now()
  cloned.updatedAt = Date.now()
  const idMap = new Map<string, string>()
  const stations: Work['stations'] = {}
  for (const [oldId, st] of Object.entries(cloned.stations)) {
    const nid = newId()
    idMap.set(oldId, nid)
    st.id = nid
    stations[nid] = st
  }
  cloned.stations = stations
  for (const line of cloned.lines) {
    line.id = newId()
    line.stationIds = line.stationIds.map((id) => idMap.get(id) ?? id)
  }
  for (const sticker of cloned.stickers) sticker.id = newId()
  for (const fh of cloned.freehands ?? []) fh.id = newId()
  return cloned
}
