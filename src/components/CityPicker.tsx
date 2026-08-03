import { useMemo, useState } from 'react'
import { pinyin } from 'pinyin-pro'
import { CITIES, type CityPreset } from '../data/cities'
import { mapRef } from '../map/mapRef'

/** 预计算每个城市的拼音（首字母 + 全拼），支持 'lz' / 'lanzhou' 搜索 */
interface CityWithPinyin {
  city: CityPreset
  initials: string
  full: string
}

/** 最多渲染的候选城市数（其余提示「继续输入缩小范围」），避免一次渲染几百个按钮卡顿 */
const MAX_RENDER = 80

const CITY_INDEX: CityWithPinyin[] = CITIES.map((city) => ({
  city,
  initials: pinyin(city.name, { pattern: 'first', toneType: 'none', type: 'array' })
    .join('')
    .toLowerCase(),
  full: pinyin(city.name.replace(/[·\s]/g, ''), { toneType: 'none', type: 'array' })
    .join('')
    .toLowerCase(),
}))

function matchCity(item: CityWithPinyin, q: string): boolean {
  const query = q.trim().toLowerCase()
  if (!query) return true
  return (
    item.city.name.includes(query) ||
    item.initials.includes(query) ||
    item.full.includes(query)
  )
}

/** 在线搜索任意地名（Nominatim，无需 key），返回坐标 */
async function searchOnline(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=zh-CN&countrycodes=cn&q=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: { lat: string; lon: string }[] = await res.json()
  if (data.length === 0) return null
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) }
}

/** 城市搜索对话框：内置约 150 城（含无地铁城市）+ 在线搜索兜底 */
export function CityPicker() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => CITY_INDEX.filter((c) => matchCity(c, query)), [query])

  const flyTo = (center: [number, number], zoom: number) => {
    mapRef.current?.flyTo(center, zoom, { duration: 1.2 })
    setOpen(false)
    setQuery('')
    setError('')
  }

  const handleOnlineSearch = async () => {
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    setError('')
    try {
      const hit = await searchOnline(q)
      if (hit) {
        flyTo([hit.lat, hit.lng], 12)
      } else {
        setError(`没有找到「${q}」，换个写法试试？比如加上“市”或“省”`)
      }
    } catch {
      setError('网络不太好～也可以直接拖动地图，想去哪就去哪！')
    } finally {
      setSearching(false)
    }
  }

  return (
    <>
      <button className="ui-select city-picker-btn" onClick={() => setOpen(true)} title="选择或搜索城市">
        🏙️ 找城市
      </button>

      {open && (
        <div className="dialog-mask" onClick={() => setOpen(false)}>
          <div className="dialog dialog-city" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">🏙️ 想去哪个城市修地铁？</div>
            <input
              className="dialog-input"
              autoFocus
              placeholder="输入城市名或拼音首字母，如：兰州 / lz / lanzhou"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (filtered.length > 0) {
                    const c = filtered[0].city
                    flyTo(c.center, c.zoom)
                  } else {
                    void handleOnlineSearch()
                  }
                }
              }}
            />

            {error && <div className="city-search-error">😢 {error}</div>}

            <div className="city-grid">
              {filtered.slice(0, MAX_RENDER).map(({ city }) => (
                <button
                  key={city.key}
                  className="city-item"
                  onClick={() => flyTo(city.center, city.zoom)}
                >
                  {city.name}
                </button>
              ))}
            </div>
            {filtered.length > MAX_RENDER && (
              <div className="city-more-hint">
                还有 {filtered.length - MAX_RENDER} 个结果，继续输入拼音首字母缩小范围～
              </div>
            )}

            {query.trim() && (
              <button
                className="btn btn-primary btn-block"
                disabled={searching}
                onClick={() => void handleOnlineSearch()}
              >
                {searching ? '🔍 正在搜索…' : `🌍 上网搜「${query.trim()}」`}
              </button>
            )}

            <button className="btn btn-block" onClick={() => setOpen(false)}>
              取消
            </button>
          </div>
        </div>
      )}
    </>
  )
}
