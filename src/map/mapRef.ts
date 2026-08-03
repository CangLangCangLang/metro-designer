import type L from 'leaflet'

/** 全局地图实例引用：供地图外的组件（城市选择器等）调用 flyTo */
export const mapRef: { current: L.Map | null } = { current: null }
