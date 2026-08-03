import { useEffect, useState } from 'react'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { linesOfStation } from '../model/transfer'

/** 可选站点图标：按场景分组的「多层菜单」，避免一屏挤太多 emoji */
const ICON_GROUPS: { key: string; label: string; icons: string[] }[] = [
  {
    key: 'traffic',
    label: '🚌 交通',
    icons: ['🚉', '🚇', '🚌', '🚏', '✈️', '🚕', '🚲', '🛴', '⛴️', '🚠'],
  },
  {
    key: 'building',
    label: '🏢 建筑',
    icons: ['🏥', '🏫', '🏟️', '🏰', '⛪', '🏦', '🏪', '🏢', '🏛️', '🏬', '🗼'],
  },
  {
    key: 'nature',
    label: '🌳 自然',
    icons: ['🌳', '🏖️', '⛲', '🌋', '🏔️', '🌉', '🎡', '🎠', '🗽', '🏯'],
  },
  {
    key: 'life',
    label: '🍔 生活',
    icons: ['🏠', '☕', '🍔', '🛒', '⛽', '🎪', '🚏', '🌇'],
  },
]
const ALL_ICONS = Array.from(new Set(ICON_GROUPS.flatMap((g) => g.icons)))

/** 底部选中操作栏：站点（改名/删除/出口/图标）与贴纸（缩放/旋转/删除），触屏大按钮 */
export function SelectionBar() {
  const work = useWorkStore((s) => s.work)
  const renameStation = useWorkStore((s) => s.renameStation)
  const deleteStation = useWorkStore((s) => s.deleteStation)
  const updateSticker = useWorkStore((s) => s.updateSticker)
  const deleteSticker = useWorkStore((s) => s.deleteSticker)
  const deleteFreehand = useWorkStore((s) => s.deleteFreehand)
  const removeStationFromLine = useWorkStore((s) => s.removeStationFromLine)
  const addStationExit = useWorkStore((s) => s.addStationExit)
  const updateStationExitLabel = useWorkStore((s) => s.updateStationExitLabel)
  const updateStationExitAngle = useWorkStore((s) => s.updateStationExitAngle)
  const removeStationExit = useWorkStore((s) => s.removeStationExit)
  const setStationIcon = useWorkStore((s) => s.setStationIcon)
  const selectedStationId = useUIStore((s) => s.selectedStationId)
  const selectedStickerId = useUIStore((s) => s.selectedStickerId)
  const selectedFreehandId = useUIStore((s) => s.selectedFreehandId)
  const selectStation = useUIStore((s) => s.selectStation)
  const selectSticker = useUIStore((s) => s.selectSticker)
  const selectFreehand = useUIStore((s) => s.selectFreehand)

  const station = work && selectedStationId ? work.stations[selectedStationId] : null
  const sticker = work?.stickers.find((s) => s.id === selectedStickerId) ?? null
  const freehand = work?.freehands?.find((f) => f.id === selectedFreehandId) ?? null

  const [nameDraft, setNameDraft] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [iconCat, setIconCat] = useState('all')
  useEffect(() => {
    setNameDraft(station?.name ?? '')
  }, [station?.id, station?.name])

  if (!work || (!station && !sticker && !freehand)) return null

  if (freehand) {
    return (
      <div className="selection-bar">
        <span className="selection-title">🖌️ 画笔线条</span>
        <span className="line-color-dot" style={{ background: freehand.color }} />
        <button
          className="btn btn-danger"
          onClick={() => {
            deleteFreehand(freehand.id)
            selectFreehand(null)
          }}
          title="删除这条画笔线条（可以撤销）"
        >
          🗑️ 删除
        </button>
        <button className="btn" onClick={() => selectFreehand(null)}>
          ✖️
        </button>
      </div>
    )
  }

  if (station) {
    const lines = linesOfStation(work, station.id)
    const isTransferStation = lines.length >= 2
    const exits = station.exits ?? []
    return (
      <>
        <div className="selection-bar scroll-x">
        <span className="selection-title">📍 车站</span>
        <input
          className="station-name-input"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => nameDraft.trim() && renameStation(station.id, nameDraft.trim())}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="给车站起个名字"
        />

        {isTransferStation && (
          <span className="transfer-badge" title="这是换乘站，同时属于多条线路">
            🔄 换乘 ×{lines.length}
          </span>
        )}

        {/* 换乘站：所属线路 chips，可单线移出 */}
        {isTransferStation && (
          <span className="transfer-lines" title="这个站属于这些线路">
            {lines.map((l) => (
              <span key={l.id} className="transfer-line-chip">
                <span className="chip-dot" style={{ background: l.color }} />
                {l.name}
                <button
                  className="chip-remove"
                  title={`从「${l.name}」移出（车站还在其他线上）`}
                  onClick={() => removeStationFromLine(l.id, station.id)}
                >
                  ✖
                </button>
              </span>
            ))}
          </span>
        )}
        {isTransferStation && (
          <span className="transfer-hint">提示：在另一线路的「画线」模式下点这个站，即可加换乘</span>
        )}

        {/* 图标选择：多层（分类）菜单，避免一屏堆太多 emoji */}
        <div className="sel-section icon-section">
          <span className="sel-section-label">图标</span>
          <button
            className="btn btn-sm icon-pick-btn"
            onClick={() => setShowIconPicker((v) => !v)}
            title="选择站点图标"
          >
            {station.icon ? `${station.icon} 换图标` : '🏷️ 选图标'}
          </button>
        </div>

        {/* 出口编辑：可改编号、可调整出口方向（绕站一圈的位置） */}
        <div className="sel-section">
          <span className="sel-section-label">出口</span>
          <div className="exit-row">
            {exits.length === 0 && <span className="exit-empty">暂无出口</span>}
            {exits.map((ex, i) => {
              const n = exits.length
              const angle = ex.angle ?? (n === 1 ? 270 : (i * 360) / n)
              return (
                <span key={ex.id} className="exit-chip">
                  <input
                    className="exit-label-input"
                    value={ex.label}
                    maxLength={4}
                    onChange={(e) => updateStationExitLabel(station.id, ex.id, e.target.value)}
                    title="出口编号"
                  />
                  <input
                    className="exit-angle"
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={angle}
                    onChange={(e) => updateStationExitAngle(station.id, ex.id, Number(e.target.value))}
                    title="拖动调整出口方向"
                  />
                  <button
                    className="exit-rotate"
                    title="旋转 15°"
                    onClick={() =>
                      updateStationExitAngle(station.id, ex.id, (angle + 15) % 360)
                    }
                  >
                    ↻
                  </button>
                  <button
                    className="exit-remove"
                    title="删除该出口"
                    onClick={() => removeStationExit(station.id, ex.id)}
                  >
                    ✖
                  </button>
                </span>
              )
            })}
            <button
              className="btn btn-sm"
              title="添加一个出口（自动编号 A/B/C…）"
              onClick={() => addStationExit(station.id)}
            >
              ＋ 出口
            </button>
          </div>
        </div>

        <button
          className="btn btn-danger"
          onClick={() => {
            deleteStation(station.id)
            selectStation(null)
          }}
          title="删除这个车站（可以撤销）"
        >
          🗑️ 删除
        </button>
        <button className="btn" onClick={() => selectStation(null)}>
          ✖️
        </button>
      </div>
      {showIconPicker && (
        <div className="icon-picker" onClick={(e) => e.stopPropagation()}>
          <div className="icon-cats">
            {ICON_GROUPS.map((g) => (
              <button
                key={g.key}
                className={`icon-cat ${iconCat === g.key ? 'on' : ''}`}
                onClick={() => setIconCat(g.key)}
              >
                {g.label}
              </button>
            ))}
            <button
              className={`icon-cat ${iconCat === 'all' ? 'on' : ''}`}
              onClick={() => setIconCat('all')}
            >
              全部
            </button>
          </div>
          <div className="icon-grid">
            <button
              className={`icon-choice ${!station.icon ? 'icon-on' : ''}`}
              title="默认圆点"
              onClick={() => {
                setStationIcon(station.id, null)
                setShowIconPicker(false)
              }}
            >
              <span className="icon-dot-default" />
            </button>
            {(iconCat === 'all' ? ALL_ICONS : ICON_GROUPS.find((g) => g.key === iconCat)!.icons).map(
              (em) => (
                <button
                  key={em}
                  className={`icon-choice ${station.icon === em ? 'icon-on' : ''}`}
                  title="设为该图标"
                  onClick={() => setStationIcon(station.id, em)}
                >
                  {em}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </>
    )
  }

  if (sticker) {
    return (
      <div className="selection-bar">
        <span className="selection-title" style={{ fontSize: 28 }}>
          {sticker.emoji}
        </span>
        <button
          className="btn"
          title="变大"
          onClick={() => updateSticker(sticker.id, { scale: Math.min(2.5, sticker.scale + 0.2) })}
        >
          🔍➕
        </button>
        <button
          className="btn"
          title="变小"
          onClick={() => updateSticker(sticker.id, { scale: Math.max(0.5, sticker.scale - 0.2) })}
        >
          🔎➖
        </button>
        <button
          className="btn"
          title="转一转"
          onClick={() => updateSticker(sticker.id, { rotation: ((sticker.rotation ?? 0) + 45) % 360 })}
        >
          🔄
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            deleteSticker(sticker.id)
            selectSticker(null)
          }}
        >
          🗑️ 删除
        </button>
        <button className="btn" onClick={() => selectSticker(null)}>
          ✖️
        </button>
      </div>
    )
  }

  return null
}
