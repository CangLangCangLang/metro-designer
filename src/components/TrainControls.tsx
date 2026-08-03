import { useWorkStore } from '../store/workStore'
import { useUIStore } from '../store/uiStore'

const SCALES: { value: number; emoji: string; label: string }[] = [
  { value: 0.5, emoji: '🐢', label: '慢放' },
  { value: 1, emoji: '🚇', label: '正常' },
  { value: 2, emoji: '🚀', label: '快进' },
]

/** 列车总控：全局播放/暂停 + 播放倍率（与每条线的时速设置相乘） */
export function TrainControls() {
  const work = useWorkStore((s) => s.work)
  const trainPlaying = useUIStore((s) => s.trainPlaying)
  const setTrainPlaying = useUIStore((s) => s.setTrainPlaying)
  const trainSpeedScale = useUIStore((s) => s.trainSpeedScale)
  const setTrainSpeedScale = useUIStore((s) => s.setTrainSpeedScale)

  if (!work) return null
  const running = work.lines.filter((l) => l.train.enabled)
  if (running.length === 0) return null

  return (
    <div className="train-controls">
      <button
        className="btn btn-primary"
        onClick={() => setTrainPlaying(!trainPlaying)}
        title={trainPlaying ? '全部停运' : '全部开跑'}
      >
        {trainPlaying ? '⏸️' : '▶️'}
      </button>
      <div className="speed-group">
        {SCALES.map((s) => (
          <button
            key={s.value}
            className={`btn speed-btn ${trainSpeedScale === s.value ? 'speed-active' : ''}`}
            title={`播放速度：${s.label}`}
            onClick={() => setTrainSpeedScale(s.value)}
          >
            {s.emoji}
          </button>
        ))}
      </div>
      <span className="train-count">🚂 {running.length} 条线路跑车中</span>
    </div>
  )
}
