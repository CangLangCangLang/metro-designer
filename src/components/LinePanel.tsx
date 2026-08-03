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

/** 计算插入位置：在 beforeIndex 之前插入时，新站的默认经纬度（邻居中点；首站前则北偏） */
function insertLatLng(
  line: Line,
  work: Work,
  beforeIndex: number,
): { lat: number; lng: number } {
  const ids = line.stationIds
  if (beforeIndex > 0) {
    const a = work.stations[ids[beforeIndex - 1]]
    const b = work.stations[ids[beforeIndex]]
    if (a && b) return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
  }
  const first = work.stations[ids[0]]
  if (first) return { lat: first.lat + 0.004, lng: first.lng }
  return work.view
}

/** 线路站点详情：站名列表 + 站间距 + 区间时速 + 全程时间 + 插入上一站 */
function StationList({ line, work }: { line: Line; work: Work }) {
  const updateLine = useWorkStore((s) => s.updateLine)
  const toggleSegmentGround = useWorkStore((s) => s.toggleSegmentGround)
  const insertStation = useWorkStore((s) => s.insertStation)
  const stops = line.stationIds
    .map((id) => work.stations[id])
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
  if (stops.length === 0) return <div className="station-list-empty">还没有车站，点地图放站吧</div>

  const lens = segmentLengthsMeters(line, work.stations)
  const minutes = tripMinutes(line, work.stations)
  const groundDefault = line.defaultGround ?? 'ground'

  const cycleSegSpeed = (segIdx: number) => {
    const current = line.segmentSpeeds?.[segIdx] ?? 0 // 0 = 自动
    const next =
      SEG_SPEED_OPTIONS[(SEG_SPEED_OPTIONS.indexOf(current) + 1) % SEG_SPEED_OPTIONS.length]
    const segSpeeds = { ...(line.segmentSpeeds ?? {}) }
    if (next === 0) delete segSpeeds[segIdx]
    else segSpeeds[segIdx] = next
    updateLine(line.id, { segmentSpeeds: segSpeeds })
  }

  const cycleSegGround = (segIdx: number) => {
    toggleSegmentGround(line.id, segIdx)
  }

  return (
    <div className="station-list">
      {stops.map((st, i) => (
        <div key={st.id}>
          {/* 在每一站之前都可插入「上一站」（首站前也能插） */}
          <button
            className="insert-before-btn"
            title="在这一站前面插入一个新车站"
            onClick={() => {
              const p = insertLatLng(line, work, i)
              insertStation(line.id, i, p.lat, p.lng)
            }}
          >
            ＋ 上一站
          </button>
          {i > 0 && (
            <div className="station-list-gap">
              <span>↓ {formatDistance(lens[i - 1] ?? 0)}</span>
              <div className="gap-btns">
                <button
                  className={`seg-speed-btn ${line.segmentSpeeds?.[i - 1] ? 'seg-speed-custom' : ''}`}
                  title="点我切换这一段的速度"
                  onClick={() => cycleSegSpeed(i - 1)}
                >
                  ⚡{line.segmentSpeeds?.[i - 1] ?? line.speedKmh ?? 80}
                </button>
                <button
                  className={`seg-ground-btn ${
                    (line.segmentGround?.[i - 1] ?? groundDefault) === 'under' ? 'seg-under' : ''
                  }`}
                  title="点我切换这一段在地上 / 地下"
                  onClick={() => cycleSegGround(i - 1)}
                >
                  {(line.segmentGround?.[i - 1] ?? groundDefault) === 'under' ? '🌑地下' : '🌞地上'}
                </button>
              </div>
            </div>
          )}
          <div className="station-list-item">
            <span className="station-list-dot" style={{ background: line.color }} />
            {st.name}
          </div>
        </div>
      ))}
      {/* 末尾也能插入（等价于在画线模式点地图追加） */}
      {stops.length > 0 && (
        <button
          className="insert-before-btn insert-at-end"
          title="在线路末尾再添加一个车站"
          onClick={() => {
            const last = work.stations[line.stationIds[line.stationIds.length - 1]]
            const p = last
              ? { lat: last.lat + 0.004, lng: last.lng }
              : work.view
            insertStation(line.id, line.stationIds.length, p.lat, p.lng)
          }}
        >
          ＋ 下一站
        </button>
      )}
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
        const groundDefault = line.defaultGround ?? 'ground'
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

            <div
              className="line-card-section"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="section-label">线型</div>
              <div className="seg-group">
                <button
                  className={`pill-btn ${style === 'solid' ? 'pill-on' : ''}`}
                  onClick={() => updateLine(line.id, { style: 'solid' })}
                >
                  ━ 实线
                </button>
                <button
                  className={`pill-btn ${style === 'dashed' ? 'pill-on' : ''}`}
                  onClick={() => updateLine(line.id, { style: 'dashed' })}
                >
                  ┅ 虚线
                </button>
              </div>

              <div className="section-label">走线</div>
              <div className="seg-group">
                <button
                  className={`pill-btn ${pathMode === 'straight' ? 'pill-on' : ''}`}
                  onClick={() => updateLine(line.id, { pathMode: 'straight' })}
                >
                  📐 直线
                </button>
                <button
                  className={`pill-btn ${pathMode === 'smooth' ? 'pill-on' : ''}`}
                  onClick={() => updateLine(line.id, { pathMode: 'smooth' })}
                >
                  〰️ 曲线
                </button>
              </div>

              <div className="section-label">
                时速 <span className="section-hint">km/h</span>
              </div>
              <div className="seg-group speed-group">
                {LINE_SPEED_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    className={`pill-btn pill-speed ${line.speedKmh === opt ? 'pill-on' : ''}`}
                    onClick={() => updateLine(line.id, { speedKmh: opt })}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <div className="section-label">默认地面（整条线）</div>
              <div className="seg-group">
                <button
                  className={`pill-btn ${groundDefault === 'ground' ? 'pill-on' : ''}`}
                  onClick={() => updateLine(line.id, { defaultGround: 'ground' })}
                >
                  🌞 地上
                </button>
                <button
                  className={`pill-btn ${groundDefault === 'under' ? 'pill-on' : ''}`}
                  onClick={() => updateLine(line.id, { defaultGround: 'under' })}
                >
                  🌑 地下
                </button>
              </div>
              <div className="section-note">
                下面每段可单独切地上 / 地下；「调整」模式下直接点地图上的某一段也能切换
              </div>
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
