import type { Work, WorkFile } from '../model/types'
import { normalizeWork } from '../model/factory'
import { cloneWorkWithNewIds } from '../store/workStore'
import { downloadText, safeFilename } from '../utils/download'

export function exportWorkToJson(work: Work): void {
  const file: WorkFile = {
    app: 'metro-designer',
    version: 1,
    exportedAt: new Date().toISOString(),
    work,
  }
  downloadText(JSON.stringify(file, null, 2), `我的地铁-${safeFilename(work.name)}.json`)
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

/** 校验并解析作品 JSON 文件；失败抛出中文错误信息 */
export function parseWorkFile(text: string): Work {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('这不是一个有效的 JSON 文件')
  }
  assert(typeof data === 'object' && data !== null, '文件内容格式不对')
  const file = data as Partial<WorkFile>
  assert(file.app === 'metro-designer', '这不是「我的地铁设计师」的作品文件')
  assert(file.version === 1, '文件版本不支持')
  const w = file.work
  assert(typeof w === 'object' && w !== null, '作品数据缺失')
  assert(typeof w.id === 'string' && typeof w.name === 'string', '作品基本信息不完整')
  assert(typeof w.stations === 'object' && w.stations !== null, '站点数据不完整')
  assert(Array.isArray(w.lines), '线路数据不完整')
  assert(Array.isArray(w.stickers), '贴纸数据不完整')
  assert(
    typeof w.view === 'object' && w.view !== null && typeof w.view.lat === 'number',
    '视角数据不完整',
  )
  // 引用完整性：线路引用的站点必须存在
  for (const line of w.lines) {
    assert(Array.isArray(line.stationIds), `线路「${line.name}」数据不完整`)
    for (const sid of line.stationIds) {
      assert(w.stations[sid], `线路「${line.name}」引用了不存在的站点`)
    }
  }
  return normalizeWork(w as Work)
}

/** 导入：解析 + 全部 id 重新生成（防与本地作品冲突），保留原名 */
export function importWorkFromJson(text: string): Work {
  const work = parseWorkFile(text)
  return cloneWorkWithNewIds(work, work.name)
}
