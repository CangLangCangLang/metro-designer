import { useEffect, useState } from 'react'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { linesOfStation } from '../model/transfer'

/** 底部选中操作栏：站点（改名/删除）与贴纸（缩放/旋转/删除），触屏大按钮 */
export function SelectionBar() {
  const work = useWorkStore((s) => s.work)
  const renameStation = useWorkStore((s) => s.renameStation)
  const deleteStation = useWorkStore((s) => s.deleteStation)
  const updateSticker = useWorkStore((s) => s.updateSticker)
  const deleteSticker = useWorkStore((s) => s.deleteSticker)
  const deleteFreehand = useWorkStore((s) => s.deleteFreehand)
  const removeStationFromLine = useWorkStore((s) => s.removeStationFromLine)
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
    return (
      <div className="selection-bar">
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
