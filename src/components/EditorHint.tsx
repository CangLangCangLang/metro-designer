import { useWorkStore } from '../store/workStore'

/** 空作品引导提示：孩子第一次进编辑器时告诉他怎么开始，放下第一站后自动消失 */
export function EditorHint() {
  const work = useWorkStore((s) => s.work)
  if (!work) return null
  const hasStations = Object.keys(work.stations).length > 0
  if (hasStations) return null

  return (
    <div className="editor-hint">
      <div className="editor-hint-emoji">👋</div>
      <div className="editor-hint-title">开始画你的地铁吧！</div>
      <div className="editor-hint-text">
        直接<b>点地图上的任意位置</b>，就能放下第一个车站
        <br />
        继续点，车站会自动连成线路 🚇
      </div>
    </div>
  )
}
