import { Fragment } from 'react'
import { Polyline } from 'react-leaflet'
import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'

const WIDTH_PX: Record<number, number> = { 1: 4, 2: 6, 3: 9 }

/** 自由画笔笔迹层：白描边 + 色芯，透明粗线做点击热区 */
export function FreehandLayer() {
  const work = useWorkStore((s) => s.work)
  const selectedFreehandId = useUIStore((s) => s.selectedFreehandId)
  const selectFreehand = useUIStore((s) => s.selectFreehand)

  if (!work) return null

  return (
    <>
      {(work.freehands ?? []).map((fh) => {
        const pts = fh.points.map((p) => [p.lat, p.lng] as [number, number])
        if (pts.length < 2) return null
        const w = WIDTH_PX[fh.width] ?? 6
        const selected = fh.id === selectedFreehandId
        return (
          <Fragment key={fh.id}>
            <Polyline
              positions={pts}
              pathOptions={{
                color: '#ffffff',
                weight: w + 5,
                opacity: selected ? 1 : 0.85,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              interactive={false}
            />
            <Polyline
              positions={pts}
              pathOptions={{
                color: fh.color,
                weight: w,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              interactive={false}
            />
            {/* 近透明粗线：点击热区（opacity 必须 >0，SVG 全透明不响应事件）；
                bubblingMouseEvents=false 阻止事件继续冒泡到 map（Leaflet 原生机制） */}
            <Polyline
              positions={pts}
              pathOptions={{ color: '#000000', weight: 24, opacity: 0.02 }}
              bubblingMouseEvents={false}
              eventHandlers={{
                click: () => selectFreehand(fh.id),
              }}
            />
          </Fragment>
        )
      })}
    </>
  )
}
