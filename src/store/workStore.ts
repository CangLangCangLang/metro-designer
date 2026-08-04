import { create } from 'zustand'
import type { Line, Sticker, StationExit, Work } from '../model/types'
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

/**
 * 删除站点后，把按区间序号存储的 Record（segmentSpeeds / segmentGround）整体平移重排，
 * 保持 key 与新的 stationIds[i]→stationIds[i+1] 对齐。k 为被删站点在 stationIds 中的下标。
 */
function reindexSegRecord<T>(
  rec: Record<number, T> | undefined,
  k: number,
): Record<number, T> | undefined {
  if (!rec) return rec
  const next: Record<number, T> = {}
  for (const [key, val] of Object.entries(rec)) {
    const i = Number(key)
    if (i < k - 1) next[i] = val // 被删区域之前的区间：序号不变
    else if (i > k) next[i - 1] = val // 之后的区间：整体前移一位
    // i === k-1 或 i === k 为与删除站相邻、被合并的区间：丢弃
  }
  return next
}

/** 在线路 stationIds 的 beforeIndex 处插入 stationId，并同步后移区间记录 */
function insertIntoLine(line: Line, beforeIndex: number, stationId: string): Line {
  const ids = [...line.stationIds]
  ids.splice(beforeIndex, 0, stationId)
  return {
    ...line,
    stationIds: ids,
    segmentSpeeds: shiftSegRecordUp(line.segmentSpeeds, beforeIndex),
    segmentGround: shiftSegRecordUp(line.segmentGround, beforeIndex),
  }
}

/**
 * 在 beforeIndex 处插入一个区间后，把按区间序号存储的 Record 整体后移一位，
 * 保持 key 与新 stationIds 对齐。k 为插入位置。
 */
function shiftSegRecordUp<T>(
  rec: Record<number, T> | undefined,
  at: number,
): Record<number, T> | undefined {
  if (!rec) return rec
  const next: Record<number, T> = {}
  for (const [key, val] of Object.entries(rec)) {
    const i = Number(key)
    next[i >= at ? i + 1 : i] = val
  }
  return next
}

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
  /** 通用线路属性更新（线样式/路径模式/线路时速/区间时速/地上地下等） */
  updateLine(
    lineId: string,
    patch: Partial<
      Pick<
        Line,
        'style' | 'pathMode' | 'speedKmh' | 'segmentSpeeds' | 'defaultGround' | 'segmentGround'
      >
    >,
  ): void

  // ---- 站点 ----
  /** 向线路末尾追加站点；snapStationId 存在则复用已有站点（形成换乘）。返回站点 id */
  addStation(lineId: string, lat: number, lng: number, snapStationId?: string): string
  /** 在线路指定下标前插入站点（新增上一站）；beforeIndex 为插入后该站在 stationIds 的位置。
   *  snapStationId 存在则插入已有站（换乘），否则在 (lat,lng) 新建站。返回站点 id */
  insertStation(
    lineId: string,
    beforeIndex: number,
    lat: number,
    lng: number,
    snapStationId?: string,
  ): string
  renameStation(stationId: string, name: string): void
  /** 拖拽结束移动站点；snapToLineId 存在时尝试吸附到该线路附近站点由调用方处理 */
  moveStation(stationId: string, lat: number, lng: number): void
  removeStationFromLine(lineId: string, stationId: string): void
  deleteStation(stationId: string): void
  /** 给站点添加出口（自动编号 A/B/C…）；返回新出口 id */
  addStationExit(stationId: string): string
  /** 修改某个出口的编号/名称 */
  updateStationExitLabel(stationId: string, exitId: string, label: string): void
  /** 删除站点某个出口 */
  removeStationExit(stationId: string, exitId: string): void
  /** 调整某个出口的方向角（度，0=正右/东，顺时针）；用于手动摆出口位置 */
  updateStationExitAngle(stationId: string, exitId: string, angle: number): void
  /** 调整某个出口离站点的距离倍数（0.5~2，1=默认）；让各出口离站远近不一 */
  updateStationExitDist(stationId: string, exitId: string, dist: number): void
  /** 设置/清除站点自定义图标（emoji；传 null 还原为默认圆点） */
  setStationIcon(stationId: string, icon: string | null): void

  // ---- 贴纸 ----
  addSticker(emoji: string, lat: number, lng: number): string
  updateSticker(id: string, patch: Partial<Sticker>): void
  deleteSticker(id: string): void

  // ---- 自由画笔 ----
  addFreehand(
    color: string,
    points: { lat: number; lng: number }[],
    width?: 1 | 2 | 3,
    startStationId?: string | null,
    endStationId?: string | null,
  ): string
  deleteFreehand(id: string): void

  // ---- 地上/地下 ----
  /** 切换某「站间区间」的地上/地下（segIdx 即 stationIds[i]→stationIds[i+1]） */
  toggleSegmentGround(lineId: string, segIdx: number): void

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
    get().mutate((w) => {
      const lines = w.lines.map((l) => {
        if (l.id !== lineId) return l
        const idx = l.stationIds.indexOf(stationId)
        if (idx < 0) return l
        return {
          ...l,
          stationIds: l.stationIds.filter((id) => id !== stationId),
          segmentSpeeds: reindexSegRecord(l.segmentSpeeds, idx),
          segmentGround: reindexSegRecord(l.segmentGround, idx),
        }
      })
      return cleanupOrphanStations({ ...w, lines })
    })
  },

  deleteStation(stationId) {
    get().mutate((w) => {
      const lines = w.lines.map((l) => {
        const idx = l.stationIds.indexOf(stationId)
        if (idx < 0) return l
        return {
          ...l,
          stationIds: l.stationIds.filter((id) => id !== stationId),
          segmentSpeeds: reindexSegRecord(l.segmentSpeeds, idx),
          segmentGround: reindexSegRecord(l.segmentGround, idx),
        }
      })
      return cleanupOrphanStations({ ...w, lines })
    })
  },

  insertStation(lineId, beforeIndex, lat, lng, snapStationId) {
    const work = get().work
    if (!work) return ''
    const snapId = snapStationId && work.stations[snapStationId] ? snapStationId : undefined
    if (!snapId) {
      const seq = Object.keys(work.stations).length + 1
      const st = createStation(`车站${seq}`, lat, lng)
      get().mutate((w) => ({
        ...w,
        stations: { ...w.stations, [st.id]: st },
        lines: w.lines.map((l) =>
          l.id === lineId ? insertIntoLine(l, beforeIndex, st.id) : l,
        ),
      }))
      return st.id
    }
    get().mutate((w) => ({
      ...w,
      lines: w.lines.map((l) =>
        l.id === lineId ? insertIntoLine(l, beforeIndex, snapId) : l,
      ),
    }))
    return snapId
  },

  addStationExit(stationId) {
    let createdId = ''
    get().mutate((w) => {
      const st = w.stations[stationId]
      if (!st) return w
      const exits = st.exits ?? []
      const used = new Set(exits.map((e) => e.label.toUpperCase()))
      let label = 'A'
      for (let c = 65; c <= 90; c++) {
        const cand = String.fromCharCode(c)
        if (!used.has(cand)) {
          label = cand
          break
        }
      }
      const exit: StationExit = { id: newId(), label, dist: 1 }
      createdId = exit.id
      return {
        ...w,
        stations: { ...w.stations, [stationId]: { ...st, exits: [...exits, exit] } },
      }
    })
    return createdId
  },

  updateStationExitLabel(stationId, exitId, label) {
    get().mutate((w) => {
      const st = w.stations[stationId]
      if (!st?.exits) return w
      return {
        ...w,
        stations: {
          ...w.stations,
          [stationId]: {
            ...st,
            exits: st.exits.map((e) => (e.id === exitId ? { ...e, label } : e)),
          },
        },
      }
    })
  },

  removeStationExit(stationId, exitId) {
    get().mutate((w) => {
      const st = w.stations[stationId]
      if (!st?.exits) return w
      return {
        ...w,
        stations: {
          ...w.stations,
          [stationId]: { ...st, exits: st.exits.filter((e) => e.id !== exitId) },
        },
      }
    })
  },

  updateStationExitAngle(stationId, exitId, angle) {
    get().mutate((w) => {
      const st = w.stations[stationId]
      if (!st?.exits) return w
      const a = ((Math.round(angle) % 360) + 360) % 360
      return {
        ...w,
        stations: {
          ...w.stations,
          [stationId]: {
            ...st,
            exits: st.exits.map((e) => (e.id === exitId ? { ...e, angle: a } : e)),
          },
        },
      }
    })
  },

  updateStationExitDist(stationId, exitId, dist) {
    get().mutate((w) => {
      const st = w.stations[stationId]
      if (!st?.exits) return w
      const d = Math.max(0.5, Math.min(2, Math.round(dist * 10) / 10))
      return {
        ...w,
        stations: {
          ...w.stations,
          [stationId]: {
            ...st,
            exits: st.exits.map((e) => (e.id === exitId ? { ...e, dist: d } : e)),
          },
        },
      }
    })
  },
  setStationIcon(stationId, icon) {
    get().mutate((w) => {
      const st = w.stations[stationId]
      if (!st) return w
      return {
        ...w,
        stations: { ...w.stations, [stationId]: { ...st, icon: icon ?? undefined } },
      }
    })
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

  addFreehand(color, points, width = 2, startStationId = null, endStationId = null) {
    const stroke = createFreehand(color, points, width, startStationId, endStationId)
    get().mutate((w) => ({ ...w, freehands: [...(w.freehands ?? []), stroke] }))
    return stroke.id
  },

  toggleSegmentGround(lineId, segIdx) {
    get().mutate((w) => {
      const lines = w.lines.map((l) => {
        if (l.id !== lineId) return l
        const groundDefault = l.defaultGround ?? 'ground'
        const current = l.segmentGround?.[segIdx] ?? groundDefault
        const next = current === 'ground' ? 'under' : 'ground'
        const segGround = { ...(l.segmentGround ?? {}) }
        if (next === groundDefault) delete segGround[segIdx]
        else segGround[segIdx] = next
        return { ...l, segmentGround: segGround }
      })
      return { ...w, lines }
    })
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
