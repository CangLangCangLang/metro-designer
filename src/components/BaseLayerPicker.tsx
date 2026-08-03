import { TILE_SOURCES } from '../map/tileLayers'
import { useUIStore } from '../store/uiStore'

/** 底图切换下拉 */
export function BaseLayerPicker() {
  const baseLayerKey = useUIStore((s) => s.baseLayerKey)
  const setBaseLayer = useUIStore((s) => s.setBaseLayer)
  return (
    <select
      className="ui-select"
      value={baseLayerKey}
      onChange={(e) => setBaseLayer(e.target.value)}
      title="切换底图"
    >
      {TILE_SOURCES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.emoji} {s.name}
        </option>
      ))}
    </select>
  )
}
