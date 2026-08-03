import { useUIStore } from '../store/uiStore'

/** 贴纸放置模式提示条：选完贴纸后面板收起，靠它告诉孩子「现在点地图就能放」 */
export function PlacingHint() {
  const placing = useUIStore((s) => s.placingStickerEmoji)
  const setPlacing = useUIStore((s) => s.setPlacingSticker)
  if (!placing) return null
  return (
    <div className="placing-hint">
      <span className="placing-hint-emoji">{placing}</span>
      <span>点地图放下它，可以连续放好几个哦</span>
      <button className="btn btn-sm btn-primary" onClick={() => setPlacing(null)}>
        不放了
      </button>
    </div>
  )
}
