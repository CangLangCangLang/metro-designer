import { useState } from 'react'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'
import { LINE_COLORS } from '../model/factory'
import {
  LINE_SPEED_OPTIONS,
  SEG_SPEED_OPTIONS,
  formatDistance,
  formatDuration,
  lineLengthMeters,
  segmentLengthsMeters,
  tripMinutes,
} from '../utils/geo'
import type { Line, Work } from '../model/types'

/** 线路站点详情：站名列表 + 站间距 + 区间时速 + 全程时间 */
function StationList({ line, work }: { line: Line; work: Work }) {
  const updateLine = useWorkStore((s) => s.updateLine)
  const stops = line.stationIds
    .map((id) => work.stations[id])
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
  if (stops.length === 0) return <div className="station-list-empty">还没有车站，点地图放站吧</div>

  const lens = segmentLengthsMeters(line, work.stations)
  const minutes = tripMinutes(line, work.stations)

  const cycleSegSpeed = (segIdx: number) => {
    const current = line.segmentSpeeds?.[segIdx] ?? 0 // 0 = 自动
    const next =
      SEG_SPEED_OPTIONS[(SEG_SPEED_OPTIONS.indexOf(current) + 1) % SEG_SPEED_OPTIONS.length]
    const segSpeeds = { ...(line.segmentSpeeds ?? {}) }
    if (next === 0) delete segSpeeds[segIdx]
    else segSpeeds[segIdx] = next
    updateLine(line.id, { segmentSpeeds: segSpeeds })
  }

  return (
    <div className="station-list">
      {stops.map((st, i) => (
        <div key={st.id}>
          {i > 0 && (
            <div className="station-list-gap">
              <span>↓ {formatDistance(lens[i - 1] ?? 0)}</span>
              <button
                className={`seg-speed-btn ${line.segmentSpeeds?.[i - 1] ? 'seg-speed-custom' : ''}`}
                title="点我切换这一段的速度"
                onClick={() => cycleSegSpeed(i - 1)}
              >
                ⚡{line.segmentSpeeds?.[i - 1] ?? line.speedKmh ?? 80}
              </button>
            </div>
          )}
          <div className="station-list-item">
            <span className="station-list-dot" style={{ background: line.color }} />
            {st.name}
          </div>
        </div>
      ))}
      {stops.length >= 2 && (
        <div className="trip-time">🕐 全程 {formatDuration(minutes)}</div>
      )}
    </div>
  )
}

/** 线路管理侧栏：新建线路、选色、命名、线型/曲直、显隐、跑车、删除、里程 */
export function LinePanel() {
  const work = useWorkStore((s) => s.work)
  const addLine = useWorkStore((s) => s.addLine)
  const renameLine = useWorkStore((s) => s.renameLine)
  const setLineColor = useWorkStore((s) => s.setLineColor)
  const toggleLineVisible = useWorkStore((s) => s.toggleLineVisible)
  const deleteLine = useWorkStore((s) => s.deleteLine)
  const setTrain = useWorkStore((s) => s.setTrain)
  const updateLine = useWorkStore((s) => s.updateLine)
  const activeLineId = useUIStore((s) => s.activeLineId)
  const setActiveLine = useUIStore((s) => s.setActiveLine)
  const setMode = useUIStore((s) => s.setMode)
  const linePanelCollapsed = useUIStore((s) => s.linePanelCollapsed)
  const setLinePanelCollapsed = useUIStore((s) => s.setLinePanelCollapsed)

  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)

  if (!work) return null

  // 收起态：只留左侧一个小按钮，显示线路数
  if (linePanelCollapsed) {
    return (
      <button
        className="panel-tab panel-tab-lines"
        onClick={() => setLinePanelCollapsed(false)}
        title="打开线路面板"
      >
        🚇 <span className="panel-tab-text">线路 {work.lines.length > 0 ? `· ${work.lines.length}` : ''}</span>
      </button>
    )
  }

  const handleNewLine = () => {
    const id = addLine()
    setActiveLine(id)
    setMode('draw')
  }

  return (
    <div className="line-panel">
      <div className="line-panel-header">
        <span className="line-panel-title">🚇 我的线路</span>
        <div className="line-panel-header-btns">
          <button className="btn btn-primary btn-sm" onClick={handleNewLine}>
            ➕ 新线路
          </button>
          <button
            className="icon-btn"
            onClick={() => setLinePanelCollapsed(true)}
            title="收起面板，画图更宽敞"
          >
            ◀
          </button>
        </div>
      </div>

      {work.lines.length === 0 && (
        <div className="line-panel-empty">
          还没有线路哦～
          <br />
          点「➕ 新线路」开始设计吧！
        </div>
      )}

      {work.lines.map((line) => {
        const km = lineLengthMeters(line, work.stations)
        const style = line.style ?? 'solid'
        const pathMode = line.pathMode ?? 'straight'
        return (
          <div
            key={line.id}
            className={`line-card ${activeLineId === line.id ? 'active' : ''}`}
            onClick={() => {
              setActiveLine(line.id)
              setMode('draw')
            }}
          >
            <div className="line-card-row">
              <button
                className="line-color-dot"
                style={{ background: line.color }}
                title="换颜色"
                onClick={(e) => {
                  e.stopPropagation()
                  setColorPickerFor(colorPickerFor === line.id ? null : line.id)
                }}
              />
              {editingId === line.id ? (
                <input
                  className="line-name-input"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => {
                    if (editName.trim()) renameLine(line.id, editName.trim())
                    setEditingId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <span
                  className="line-name"
                  title="双击改名"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditingId(line.id)
                    setEditName(line.name)
                  }}
                >
                  {line.name}
                </span>
              )}
              <button
                className="line-st-count line-detail-toggle"
                title="展开站点列表"
                onClick={(e) => {
                  e.stopPropagation()
                  setDetailFor(detailFor === line.id ? null : line.id)
                }}
              >
                {line.stationIds.length}站 · {formatDistance(km)} {detailFor === line.id ? '▴' : '▾'}
              </button>
            </div>

            <div className="line-card-row line-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="icon-btn"
                title={line.visible ? '隐藏线路' : '显示线路'}
                onClick={() => toggleLineVisible(line.id)}
              >
                {line.visible ? '👁️' : '🚫'}
              </button>
              <button
                className={`icon-btn ${line.train.enabled ? 'icon-btn-on' : ''}`}
                title={line.train.enabled ? '列车停运' : '列车开跑'}
                onClick={() => setTrain(line.id, { enabled: !line.train.enabled })}
              >
                🚂
              </button>
              <button
                className="icon-btn"
                title="重命名"
                onClick={() => {
                  setEditingId(line.id)
                  setEditName(line.name)
                }}
              >
                ✏️
              </button>
              <button
                className="icon-btn icon-btn-danger"
                title="删除线路"
                onClick={() => setConfirmDeleteId(line.id)}
              >
                🗑️
              </button>
            </div>

            <div className="line-card-row line-style-row" onClick={(e) => e.stopPropagation()}>
              <button
                className={`style-btn ${style === 'solid' ? 'style-on' : ''}`}
                title="实线（已开通）"
                onClick={() => updateLine(line.id, { style: 'solid' })}
              >
                ━ 实线
              </button>
              <button
                className={`style-btn ${style === 'dashed' ? 'style-on' : ''}`}
                title="虚线（规划中）"
                onClick={() => updateLine(line.id, { style: 'dashed' })}
              >
                ┅ 虚线
              </button>
              <button
                className={`style-btn ${pathMode === 'straight' ? 'style-on' : ''}`}
                title="直线"
                onClick={() => updateLine(line.id, { pathMode: 'straight' })}
              >
                📐 直线
              </button>
              <button
                className={`style-btn ${pathMode === 'smooth' ? 'style-on' : ''}`}
                title="曲线"
                onClick={() => updateLine(line.id, { pathMode: 'smooth' })}
              >
                〰️ 曲线
              </button>
              <button
                className="style-btn style-btn-speed"
                title="线路时速：点我切换（60/80/100/120 km/h）"
                onClick={() => {
                  const cur = line.speedKmh ?? 80
                  const idx = LINE_SPEED_OPTIONS.indexOf(cur)
                  const next = LINE_SPEED_OPTIONS[(idx + 1) % LINE_SPEED_OPTIONS.length]
                  updateLine(line.id, { speedKmh: next })
                }}
              >
                ⚡{line.speedKmh ?? 80}
              </button>
            </div>

            {detailFor === line.id && <StationList line={line} work={work} />}

            {colorPickerFor === line.id && (
              <div className="color-palette" onClick={(e) => e.stopPropagation()}>
                {LINE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-swatch ${c === line.color ? 'current' : ''}`}
                    style={{ background: c }}
                    onClick={() => {
                      setLineColor(line.id, c)
                      setColorPickerFor(null)
                    }}
                  />
                ))}
              </div>
            )}

            {confirmDeleteId === line.id && (
              <div className="confirm-bar" onClick={(e) => e.stopPropagation()}>
                <span>确定删除「{line.name}」吗？</span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    deleteLine(line.id)
                    setConfirmDeleteId(null)
                    if (activeLineId === line.id) setActiveLine(null)
                  }}
                >
                  删除
                </button>
                <button className="btn btn-sm" onClick={() => setConfirmDeleteId(null)}>
                  取消
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
