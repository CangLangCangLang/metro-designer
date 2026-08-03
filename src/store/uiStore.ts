import { create } from 'zustand'

/** browse=浏览(锁定防误触) draw=画线(点击放站) adjust=调整(站点可拖) freehand=自由画笔(手动画线) */
export type EditMode = 'browse' | 'draw' | 'adjust' | 'freehand'

const BASE_LAYER_KEY = 'md:baseLayer'
const TOOLBAR_COLLAPSED_KEY = 'md:toolbarCollapsed'
const LINE_PANEL_COLLAPSED_KEY = 'md:linePanelCollapsed'

interface UIStore {
  mode: EditMode
  activeLineId: string | null
  selectedStationId: string | null
  selectedStickerId: string | null
  /** 选中的画笔线条 id */
  selectedFreehandId: string | null
  /** 吸附预览高亮的站点 id */
  snapPreviewStationId: string | null
  /** 正在放置的贴纸 emoji（非 null 时点击地图放贴纸） */
  placingStickerEmoji: string | null
  baseLayerKey: string
  trainPlaying: boolean
  /** 列车播放倍率：0.5 慢放 / 1 正常 / 2 快进（与线路时速相乘） */
  trainSpeedScale: number
  stickerPanelOpen: boolean
  /** 顶部工具栏已收起（只留小按钮） */
  toolbarCollapsed: boolean
  /** 线路面板已收起（只留小按钮） */
  linePanelCollapsed: boolean

  setMode(mode: EditMode): void
  setActiveLine(id: string | null): void
  selectStation(id: string | null): void
  selectSticker(id: string | null): void
  selectFreehand(id: string | null): void
  setSnapPreview(id: string | null): void
  setPlacingSticker(emoji: string | null): void
  setBaseLayer(key: string): void
  setTrainPlaying(playing: boolean): void
  setTrainSpeedScale(scale: number): void
  setStickerPanelOpen(open: boolean): void
  setToolbarCollapsed(collapsed: boolean): void
  setLinePanelCollapsed(collapsed: boolean): void
  /** 切换作品/页面时复位瞬态 */
  resetTransient(): void
}

export const useUIStore = create<UIStore>((set) => ({
  mode: 'draw',
  activeLineId: null,
  selectedStationId: null,
  selectedStickerId: null,
  selectedFreehandId: null,
  snapPreviewStationId: null,
  placingStickerEmoji: null,
  baseLayerKey: localStorage.getItem(BASE_LAYER_KEY) ?? 'gaode',
  trainPlaying: true,
  trainSpeedScale: 1,
  stickerPanelOpen: false,
  // 默认收起（孩子反馈面板太占地图）：只有显式展开过才展开
  toolbarCollapsed: localStorage.getItem(TOOLBAR_COLLAPSED_KEY) !== '0',
  linePanelCollapsed: localStorage.getItem(LINE_PANEL_COLLAPSED_KEY) !== '0',

  setMode: (mode) => set({ mode, placingStickerEmoji: null }),
  setActiveLine: (id) => set({ activeLineId: id }),
  selectStation: (id) => set({ selectedStationId: id, selectedStickerId: null, selectedFreehandId: null }),
  selectSticker: (id) => set({ selectedStickerId: id, selectedStationId: null, selectedFreehandId: null }),
  selectFreehand: (id) => set({ selectedFreehandId: id, selectedStationId: null, selectedStickerId: null }),
  setSnapPreview: (id) => set({ snapPreviewStationId: id }),
  setPlacingSticker: (emoji) => set({ placingStickerEmoji: emoji, stickerPanelOpen: false }),
  setBaseLayer: (key) => {
    localStorage.setItem(BASE_LAYER_KEY, key)
    set({ baseLayerKey: key })
  },
  setTrainPlaying: (playing) => set({ trainPlaying: playing }),
  setTrainSpeedScale: (scale) => set({ trainSpeedScale: scale }),
  setStickerPanelOpen: (open) => set({ stickerPanelOpen: open }),
  setToolbarCollapsed: (collapsed) => {
    localStorage.setItem(TOOLBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    set({ toolbarCollapsed: collapsed })
  },
  setLinePanelCollapsed: (collapsed) => {
    localStorage.setItem(LINE_PANEL_COLLAPSED_KEY, collapsed ? '1' : '0')
    set({ linePanelCollapsed: collapsed })
  },
  resetTransient: () =>
    set({
      activeLineId: null,
      selectedStationId: null,
      selectedStickerId: null,
      selectedFreehandId: null,
      snapPreviewStationId: null,
      placingStickerEmoji: null,
      stickerPanelOpen: false,
      mode: 'draw',
    }),
}))
