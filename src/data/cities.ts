/** 城市预设：坐标为市中心近似值（GCJ-02 系，配合默认高德底图；城市级定位足够精确） */
export interface CityPreset {
  key: string
  name: string
  center: [number, number]
  zoom: number
}

/**
 * 内置约 150 城：直辖市、省会、计划单列市及主要地级市。
 * 没有地铁的城市也收录——孩子可以在任何地方修自己的地铁！
 */
export const CITIES: CityPreset[] = [
  // 直辖市
  { key: 'beijing', name: '北京', center: [39.9042, 116.4074], zoom: 11 },
  { key: 'tianjin', name: '天津', center: [39.0842, 117.201], zoom: 11 },
  { key: 'shanghai', name: '上海', center: [31.2304, 121.4737], zoom: 11 },
  { key: 'chongqing', name: '重庆', center: [29.563, 106.5516], zoom: 11 },
  // 河北
  { key: 'shijiazhuang', name: '石家庄', center: [38.0428, 114.5149], zoom: 12 },
  { key: 'tangshan', name: '唐山', center: [39.6305, 118.1802], zoom: 12 },
  { key: 'baoding', name: '保定', center: [38.874, 115.4646], zoom: 12 },
  { key: 'handan', name: '邯郸', center: [36.6256, 114.5391], zoom: 12 },
  { key: 'qinhuangdao', name: '秦皇岛', center: [39.9354, 119.6005], zoom: 12 },
  { key: 'zhangjiakou', name: '张家口', center: [40.7675, 114.8863], zoom: 12 },
  { key: 'chengde', name: '承德', center: [40.9515, 117.9634], zoom: 12 },
  { key: 'xiongan', name: '雄安新区', center: [38.9356, 115.9345], zoom: 12 },
  // 山西
  { key: 'taiyuan', name: '太原', center: [37.8706, 112.5489], zoom: 12 },
  { key: 'datong', name: '大同', center: [40.0768, 113.3001], zoom: 12 },
  { key: 'linfen', name: '临汾', center: [36.088, 111.519], zoom: 12 },
  { key: 'yuncheng', name: '运城', center: [35.0264, 111.0075], zoom: 12 },
  // 内蒙古
  { key: 'huhehaote', name: '呼和浩特', center: [40.8426, 111.7492], zoom: 12 },
  { key: 'baotou', name: '包头', center: [40.6574, 109.8404], zoom: 12 },
  { key: 'eerduosi', name: '鄂尔多斯', center: [39.6083, 109.7813], zoom: 12 },
  { key: 'chifeng', name: '赤峰', center: [42.2574, 118.8889], zoom: 12 },
  // 辽宁
  { key: 'shenyang', name: '沈阳', center: [41.8057, 123.4315], zoom: 11 },
  { key: 'dalian', name: '大连', center: [38.914, 121.6147], zoom: 11 },
  { key: 'anshan', name: '鞍山', center: [41.108, 122.9943], zoom: 12 },
  { key: 'jinzhou', name: '锦州', center: [41.0955, 121.1272], zoom: 12 },
  { key: 'dandong', name: '丹东', center: [40.0006, 124.3547], zoom: 12 },
  // 吉林
  { key: 'changchun', name: '长春', center: [43.8171, 125.3235], zoom: 11 },
  { key: 'jilin', name: '吉林市', center: [43.8379, 126.5496], zoom: 12 },
  { key: 'yanji', name: '延吉', center: [42.8911, 129.5089], zoom: 12 },
  // 黑龙江
  { key: 'haerbin', name: '哈尔滨', center: [45.8038, 126.5349], zoom: 11 },
  { key: 'daqing', name: '大庆', center: [46.5876, 125.1039], zoom: 12 },
  { key: 'qiqihaer', name: '齐齐哈尔', center: [47.3543, 123.9182], zoom: 12 },
  { key: 'mudanjiang', name: '牡丹江', center: [44.5517, 129.6331], zoom: 12 },
  // 江苏
  { key: 'nanjing', name: '南京', center: [32.0603, 118.7969], zoom: 11 },
  { key: 'suzhou', name: '苏州', center: [31.2989, 120.5853], zoom: 11 },
  { key: 'wuxi', name: '无锡', center: [31.4912, 120.3119], zoom: 11 },
  { key: 'changzhou', name: '常州', center: [31.8112, 119.9741], zoom: 12 },
  { key: 'xuzhou', name: '徐州', center: [34.2058, 117.2841], zoom: 12 },
  { key: 'nantong', name: '南通', center: [31.9802, 120.8943], zoom: 12 },
  { key: 'yangzhou', name: '扬州', center: [32.3944, 119.413], zoom: 12 },
  { key: 'zhenjiang', name: '镇江', center: [32.1887, 119.4244], zoom: 12 },
  { key: 'yancheng', name: '盐城', center: [33.3474, 120.1636], zoom: 12 },
  { key: 'lianyungang', name: '连云港', center: [34.5967, 119.2216], zoom: 12 },
  // 浙江
  { key: 'hangzhou', name: '杭州', center: [30.2741, 120.1551], zoom: 11 },
  { key: 'ningbo', name: '宁波', center: [29.8683, 121.544], zoom: 11 },
  { key: 'wenzhou', name: '温州', center: [27.9944, 120.6994], zoom: 12 },
  { key: 'jiaxing', name: '嘉兴', center: [30.7461, 120.7555], zoom: 12 },
  { key: 'shaoxing', name: '绍兴', center: [30.0303, 120.5802], zoom: 12 },
  { key: 'jinhua', name: '金华', center: [29.0792, 119.6474], zoom: 12 },
  { key: 'taizhou', name: '台州', center: [28.6564, 121.4208], zoom: 12 },
  { key: 'huzhou', name: '湖州', center: [30.8933, 120.0868], zoom: 12 },
  { key: 'zhoushan', name: '舟山', center: [29.9855, 122.2078], zoom: 12 },
  // 安徽
  { key: 'hefei', name: '合肥', center: [31.8206, 117.2272], zoom: 11 },
  { key: 'wuhu', name: '芜湖', center: [31.3529, 118.433], zoom: 12 },
  { key: 'bangbu', name: '蚌埠', center: [32.9163, 117.3897], zoom: 12 },
  { key: 'maanshan', name: '马鞍山', center: [31.6704, 118.5068], zoom: 12 },
  { key: 'anqing', name: '安庆', center: [30.5429, 117.0637], zoom: 12 },
  { key: 'fuyang', name: '阜阳', center: [32.8901, 115.8142], zoom: 12 },
  // 福建
  { key: 'fuzhou', name: '福州', center: [26.0745, 119.2965], zoom: 11 },
  { key: 'xiamen', name: '厦门', center: [24.4798, 118.0894], zoom: 11 },
  { key: 'quanzhou', name: '泉州', center: [24.8741, 118.6759], zoom: 12 },
  { key: 'zhangzhou', name: '漳州', center: [24.5135, 117.6471], zoom: 12 },
  { key: 'putian', name: '莆田', center: [25.4541, 119.0076], zoom: 12 },
  { key: 'longyan', name: '龙岩', center: [25.0751, 117.0173], zoom: 12 },
  // 江西
  { key: 'nanchang', name: '南昌', center: [28.682, 115.8582], zoom: 11 },
  { key: 'jiujiang', name: '九江', center: [29.7051, 115.9996], zoom: 12 },
  { key: 'ganzhou', name: '赣州', center: [25.8311, 114.9348], zoom: 12 },
  { key: 'jingdezhen', name: '景德镇', center: [29.2687, 117.1784], zoom: 12 },
  { key: 'shangrao', name: '上饶', center: [28.4549, 117.9432], zoom: 12 },
  // 山东
  { key: 'jinan', name: '济南', center: [36.6512, 117.1201], zoom: 11 },
  { key: 'qingdao', name: '青岛', center: [36.0671, 120.3826], zoom: 11 },
  { key: 'yantai', name: '烟台', center: [37.4638, 121.4479], zoom: 12 },
  { key: 'weifang', name: '潍坊', center: [36.7069, 119.1618], zoom: 12 },
  { key: 'zibo', name: '淄博', center: [36.8135, 118.0548], zoom: 12 },
  { key: 'weihai', name: '威海', center: [37.5135, 122.1217], zoom: 12 },
  { key: 'linyi', name: '临沂', center: [35.1047, 118.3564], zoom: 12 },
  { key: 'jining', name: '济宁', center: [35.4149, 116.5872], zoom: 12 },
  { key: 'taian', name: '泰安', center: [36.2003, 117.0876], zoom: 12 },
  // 河南
  { key: 'zhengzhou', name: '郑州', center: [34.7466, 113.6254], zoom: 11 },
  { key: 'luoyang', name: '洛阳', center: [34.6181, 112.454], zoom: 12 },
  { key: 'kaifeng', name: '开封', center: [34.7972, 114.3077], zoom: 12 },
  { key: 'xinxiang', name: '新乡', center: [35.303, 113.9268], zoom: 12 },
  { key: 'nanyang', name: '南阳', center: [32.9908, 112.5285], zoom: 12 },
  { key: 'anyang', name: '安阳', center: [36.0976, 114.3924], zoom: 12 },
  { key: 'xuchang', name: '许昌', center: [34.0355, 113.8523], zoom: 12 },
  { key: 'shangqiu', name: '商丘', center: [34.4442, 115.6564], zoom: 12 },
  // 湖北
  { key: 'wuhan', name: '武汉', center: [30.5928, 114.3055], zoom: 11 },
  { key: 'yichang', name: '宜昌', center: [30.6919, 111.2865], zoom: 12 },
  { key: 'xiangyang', name: '襄阳', center: [32.009, 112.1226], zoom: 12 },
  { key: 'jingzhou', name: '荆州', center: [30.3355, 112.2397], zoom: 12 },
  { key: 'huangshi', name: '黄石', center: [30.1996, 115.0387], zoom: 12 },
  { key: 'shiyan', name: '十堰', center: [32.6294, 110.798], zoom: 12 },
  // 湖南
  { key: 'changsha', name: '长沙', center: [28.2282, 112.9388], zoom: 11 },
  { key: 'zhuzhou', name: '株洲', center: [27.8274, 113.134], zoom: 12 },
  { key: 'xiangtan', name: '湘潭', center: [27.8297, 112.944], zoom: 12 },
  { key: 'hengyang', name: '衡阳', center: [26.8932, 112.572], zoom: 12 },
  { key: 'yueyang', name: '岳阳', center: [29.3573, 113.1287], zoom: 12 },
  { key: 'changde', name: '常德', center: [29.0317, 111.6985], zoom: 12 },
  // 广东
  { key: 'guangzhou', name: '广州', center: [23.1291, 113.2644], zoom: 11 },
  { key: 'shenzhen', name: '深圳', center: [22.5431, 114.0579], zoom: 11 },
  { key: 'zhuhai', name: '珠海', center: [22.2707, 113.5767], zoom: 12 },
  { key: 'foshan', name: '佛山', center: [23.0215, 113.1214], zoom: 11 },
  { key: 'dongguan', name: '东莞', center: [23.0207, 113.7518], zoom: 11 },
  { key: 'zhongshan', name: '中山', center: [22.5176, 113.3928], zoom: 12 },
  { key: 'huizhou', name: '惠州', center: [23.1115, 114.4162], zoom: 12 },
  { key: 'shantou', name: '汕头', center: [23.3535, 116.6822], zoom: 12 },
  { key: 'jiangmen', name: '江门', center: [22.5787, 113.0818], zoom: 12 },
  { key: 'zhanjiang', name: '湛江', center: [21.2707, 110.3594], zoom: 12 },
  { key: 'zhaoqing', name: '肇庆', center: [23.0472, 112.4651], zoom: 12 },
  { key: 'qingyuan', name: '清远', center: [23.6818, 113.0561], zoom: 12 },
  { key: 'shaoguan', name: '韶关', center: [24.8109, 113.5975], zoom: 12 },
  { key: 'meizhou', name: '梅州', center: [24.2886, 116.1226], zoom: 12 },
  { key: 'maoming', name: '茂名', center: [21.6633, 110.9255], zoom: 12 },
  // 广西
  { key: 'nanning', name: '南宁', center: [22.817, 108.3665], zoom: 11 },
  { key: 'liuzhou', name: '柳州', center: [24.3264, 109.4281], zoom: 12 },
  { key: 'guilin', name: '桂林', center: [25.2345, 110.1799], zoom: 12 },
  { key: 'wuzhou', name: '梧州', center: [23.4769, 111.2792], zoom: 12 },
  { key: 'beihai', name: '北海', center: [21.4811, 109.1201], zoom: 12 },
  { key: 'yulin', name: '玉林', center: [22.6546, 110.1809], zoom: 12 },
  // 海南
  { key: 'haikou', name: '海口', center: [20.0444, 110.1987], zoom: 12 },
  { key: 'sanya', name: '三亚', center: [18.2535, 109.5117], zoom: 12 },
  // 四川
  { key: 'chengdu', name: '成都', center: [30.5728, 104.0668], zoom: 11 },
  { key: 'mianyang', name: '绵阳', center: [31.4675, 104.6796], zoom: 12 },
  { key: 'deyang', name: '德阳', center: [31.127, 104.398], zoom: 12 },
  { key: 'yibin', name: '宜宾', center: [28.7513, 104.6428], zoom: 12 },
  { key: 'nanchong', name: '南充', center: [30.8373, 106.1107], zoom: 12 },
  { key: 'leshan', name: '乐山', center: [29.5521, 103.7654], zoom: 12 },
  { key: 'luzhou', name: '泸州', center: [28.8718, 105.4423], zoom: 12 },
  { key: 'dazhou', name: '达州', center: [31.2096, 107.4681], zoom: 12 },
  // 贵州
  { key: 'guiyang', name: '贵阳', center: [26.647, 106.6302], zoom: 11 },
  { key: 'zunyi', name: '遵义', center: [27.7254, 106.9274], zoom: 12 },
  { key: 'anshun', name: '安顺', center: [26.2532, 105.9476], zoom: 12 },
  // 云南
  { key: 'kunming', name: '昆明', center: [24.8801, 102.8329], zoom: 11 },
  { key: 'dali', name: '大理', center: [25.6065, 100.2676], zoom: 12 },
  { key: 'qujing', name: '曲靖', center: [25.4907, 103.7962], zoom: 12 },
  { key: 'lijiang', name: '丽江', center: [26.8765, 100.2271], zoom: 12 },
  { key: 'xishuangbanna', name: '西双版纳', center: [22.0074, 100.7979], zoom: 12 },
  // 西藏
  { key: 'lasa', name: '拉萨', center: [29.6525, 91.1406], zoom: 12 },
  // 陕西
  { key: 'xian', name: '西安', center: [34.3416, 108.9398], zoom: 11 },
  { key: 'xianyang', name: '咸阳', center: [34.3296, 108.7093], zoom: 12 },
  { key: 'baoji', name: '宝鸡', center: [34.3619, 107.2373], zoom: 12 },
  { key: 'weinan', name: '渭南', center: [34.4997, 109.5098], zoom: 12 },
  { key: 'yulin-shaanxi', name: '榆林', center: [38.2853, 109.7346], zoom: 12 },
  { key: 'hanzhong', name: '汉中', center: [33.0677, 107.0233], zoom: 12 },
  // 甘肃
  { key: 'lanzhou', name: '兰州', center: [36.0611, 103.8343], zoom: 11 },
  { key: 'tianshui', name: '天水', center: [34.5809, 105.7249], zoom: 12 },
  { key: 'jiuquan', name: '酒泉', center: [39.7325, 98.4944], zoom: 12 },
  { key: 'zhangye', name: '张掖', center: [38.9259, 100.4498], zoom: 12 },
  // 青海 / 宁夏 / 新疆
  { key: 'xining', name: '西宁', center: [36.6171, 101.7782], zoom: 12 },
  { key: 'yinchuan', name: '银川', center: [38.4872, 106.2309], zoom: 12 },
  { key: 'wulumuqi', name: '乌鲁木齐', center: [43.8256, 87.6168], zoom: 11 },
  { key: 'kashi', name: '喀什', center: [39.4677, 75.9938], zoom: 12 },
  { key: 'yining', name: '伊宁', center: [43.9172, 81.3241], zoom: 12 },
  { key: 'kelamayi', name: '克拉玛依', center: [45.5799, 84.8892], zoom: 12 },
  // 港澳台
  { key: 'xianggang', name: '中国香港', center: [22.3193, 114.1694], zoom: 11 },
  { key: 'aomen', name: '中国澳门', center: [22.1987, 113.5439], zoom: 12 },
  { key: 'taibei', name: '中国台湾·台北', center: [25.033, 121.5654], zoom: 11 },
  { key: 'gaoxiong', name: '中国台湾·高雄', center: [22.6273, 120.3014], zoom: 12 },
]

export function cityByKey(key: string | undefined): CityPreset | undefined {
  return CITIES.find((c) => c.key === key)
}
