export interface StickerCategory {
  key: string
  name: string
  emoji: string
  items: { emoji: string; label: string }[]
}

/** 贴纸目录：给孩子装饰自己的城市 */
export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    key: 'transport',
    name: '交通',
    emoji: '🚄',
    items: [
      { emoji: '✈️', label: '机场' },
      { emoji: '🚉', label: '火车站' },
      { emoji: '🚄', label: '高铁' },
      { emoji: '🚌', label: '公交' },
      { emoji: '🚢', label: '轮船' },
      { emoji: '🚠', label: '缆车' },
      { emoji: '🚁', label: '直升机' },
      { emoji: '⛵', label: '帆船' },
    ],
  },
  {
    key: 'nature',
    name: '自然',
    emoji: '🌳',
    items: [
      { emoji: '🌳', label: '公园' },
      { emoji: '🏞️', label: '风景区' },
      { emoji: '⛰️', label: '山' },
      { emoji: '🌊', label: '河流' },
      { emoji: '🏖️', label: '海滩' },
      { emoji: '🌸', label: '花海' },
      { emoji: '🍁', label: '枫叶' },
      { emoji: '🐼', label: '熊猫' },
    ],
  },
  {
    key: 'building',
    name: '建筑',
    emoji: '🏙️',
    items: [
      { emoji: '🏙️', label: '高楼' },
      { emoji: '🏟️', label: '体育场' },
      { emoji: '🏰', label: '城堡' },
      { emoji: '🎡', label: '摩天轮' },
      { emoji: '🗼', label: '高塔' },
      { emoji: '⛲', label: '喷泉' },
      { emoji: '🏫', label: '学校' },
      { emoji: '🏥', label: '医院' },
    ],
  },
  {
    key: 'fun',
    name: '趣味',
    emoji: '🎈',
    items: [
      { emoji: '⭐', label: '星星' },
      { emoji: '❤️', label: '爱心' },
      { emoji: '🎈', label: '气球' },
      { emoji: '🏁', label: '终点旗' },
      { emoji: '🚀', label: '火箭' },
      { emoji: '🦕', label: '恐龙' },
      { emoji: '🎠', label: '旋转木马' },
      { emoji: '📍', label: '定位' },
    ],
  },
]
