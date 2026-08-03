import { STICKER_CATEGORIES } from '../data/stickers'
import { useUIStore } from '../store/uiStore'

/** 贴纸面板：选一种贴纸后点地图放置（可连续放，再点一次取消） */
export function StickerPalette() {
  const open = useUIStore((s) => s.stickerPanelOpen)
  const setOpen = useUIStore((s) => s.setStickerPanelOpen)
  const placing = useUIStore((s) => s.placingStickerEmoji)
  const setPlacing = useUIStore((s) => s.setPlacingSticker)

  if (!open) return null

  return (
    <div className="sticker-palette">
      <div className="sticker-palette-header">
        <span>🎨 选一个贴纸，再点地图放上去</span>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>
          ✖️
        </button>
      </div>
      <div className="sticker-palette-body">
        {STICKER_CATEGORIES.map((cat) => (
          <div key={cat.key} className="sticker-category">
            <div className="sticker-category-name">
              {cat.emoji} {cat.name}
            </div>
            <div className="sticker-grid">
              {cat.items.map((item) => (
                <button
                  key={item.emoji}
                  className={`sticker-item ${placing === item.emoji ? 'sticker-item-active' : ''}`}
                  title={item.label}
                  onClick={() => setPlacing(placing === item.emoji ? null : item.emoji)}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
