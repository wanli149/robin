/**
 * Auto Classifier Service
 * 自动分类服务 V2
 * 
 * 核心策略（优先级从高到低）：
 * 1. 基于 type_name（资源站返回的中文分类名）智能识别 - 最可靠
 * 2. 基于视频名称/内容的关键词识别 - 补充验证
 * 3. 基于 type_id 范围推断 - 兜底方案
 * 
 * 设计原则：任何苹果CMS资源站都能自动适配，无需预设配置
 */

import { logger } from '../utils/logger';

// 数据库行类型定义
interface CategoryMappingRow {
  source_id: string;
  source_name: string | null;
  source_type_id: number;
  target_category_id: number;
}

interface SubCategoryRow {
  id: number;
  parent_id: number;
  name: string;
  name_en: string | null;
  keywords: string | null;
}

// 视频分类输入类型
interface VideoClassifyInput {
  vod_name: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_remarks?: string;
  vod_tag?: string;
  type_id?: number | string;
  type_name?: string;
  source_name?: string;
}

// 分类结果类型
interface ClassifyResult {
  typeId: number;
  typeName: string;
  subTypeId?: number;
  subTypeName?: string;
  confidence: number;
  classifyMethod?: string;
}

// 数据库映射缓存
let dbMappingCache: Map<string, Map<string, number>> | null = null;
let dbMappingCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// ============================================
// 基于 type_name 的智能分类（核心）
// ============================================

/**
 * 分类规则配置
 * 基于资源站返回的 type_name 进行智能匹配
 */
const TYPE_NAME_RULES: Array<{
  targetId: number;
  targetName: string;
  patterns: string[];      // 包含这些词则匹配
  excludes?: string[];     // 排除这些词
  subTypeExtract?: boolean; // 是否提取子分类
}> = [
  {
    // 预告片/解说优先级最高（避免被电影匹配）
    targetId: 8,
    targetName: '预告片',
    patterns: ['预告', '预告片', 'trailer', '先导片', '花絮', '解说', '影视解说'],
    subTypeExtract: true,
  },
  {
    // 福利/成人内容（需要特殊权限）
    targetId: 9,
    targetName: '福利',
    patterns: ['伦理', '三级', '两性', '写真', '热舞', '福利', '成人'],
    subTypeExtract: true,
  },
  {
    targetId: 5,
    targetName: '短剧',
    // 添加资源站的短剧子分类名称
    patterns: ['短剧', '微短剧', '竖屏剧', '女频', '恋爱', '爽文短剧', '反转爽剧', '古装仙侠', '年代穿越', '脑洞悬疑', '现代都市', '擦边短剧', '漫剧'],
    excludes: ['恋爱片'],  // 排除电影
    subTypeExtract: true,
  },
  {
    targetId: 6,
    targetName: '体育',
    patterns: ['体育', '足球', '篮球', '网球', '斯诺克', 'NBA', 'CBA', '世界杯', '欧冠', '英超', '西甲', '德甲', '意甲', '中超', '赛事', '比赛直播', '电竞', 'UFC', '拳击'],
    subTypeExtract: true,
  },
  {
    // 纪录片/科普单独分类
    targetId: 7,
    targetName: '纪录片',
    patterns: ['纪录片', '纪录', '记录片', '记录', '纪实', '探索', '自然', 'BBC', 'Discovery', '科普', '学习', '教育'],
    excludes: ['纪录剧'],
    subTypeExtract: true,
  },
  {
    targetId: 3,
    targetName: '综艺',
    patterns: ['综艺', '真人秀', '脱口秀', '晚会', '演唱会'],
    excludes: ['体育'],
    subTypeExtract: true,
  },
  {
    targetId: 4,
    targetName: '动漫',
    patterns: ['动漫', '动画', '番剧', '国漫', '日漫', '新番', 'OVA'],
    excludes: ['动作'],  // 排除"动作片"
    subTypeExtract: true,
  },
  {
    // 电影规则放在电视剧之前，优先匹配"XX片"
    targetId: 1,
    targetName: '电影',
    patterns: ['片', '电影', '影片', '剧场版'],
    // 排除真正的电视剧类型（国产剧、韩剧等）和其他类型
    excludes: ['国产剧', '韩剧', '日剧', '美剧', '泰剧', '港剧', '台剧', '英剧', '内地剧', '香港剧', '台湾剧', '韩国剧', '日本剧', '欧美剧', '海外剧', '电视剧', '连续剧', '网剧', '短剧', '综艺', '动漫', '动画', '体育', '纪录片', '预告片', '预告', '解说'],
    subTypeExtract: true,
  },
  {
    targetId: 2,
    targetName: '电视剧',
    patterns: ['剧', '连续剧', '电视剧', '网剧', '迷你剧', '悬疑'],
    // 排除短剧相关的关键词，避免误分类
    excludes: ['短剧', '动漫', '动画', '综艺', '纪录', '体育', '预告', '解说', '女频', '爽文', '反转爽剧', '古装仙侠', '年代穿越', '脑洞悬疑', '现代都市', '擦边短剧', '漫剧'],
    subTypeExtract: true,
  },
];

/**
 * 子分类提取规则
 * 从 type_name 中提取子分类信息
 */
const SUB_TYPE_EXTRACT_RULES: Record<number, Array<{
  subName: string;
  patterns: string[];
}>> = {
  1: [ // 电影子分类
    { subName: '动作', patterns: ['动作'] },
    { subName: '喜剧', patterns: ['喜剧', '搞笑'] },
    { subName: '爱情', patterns: ['爱情', '浪漫'] },
    { subName: '科幻', patterns: ['科幻'] },
    { subName: '恐怖', patterns: ['恐怖', '惊悚'] },
    { subName: '悬疑', patterns: ['悬疑', '推理', '犯罪'] },
    { subName: '战争', patterns: ['战争', '军事'] },
    { subName: '剧情', patterns: ['剧情', '文艺'] },
    { subName: '动画', patterns: ['动画', '剧场版'] },
    { subName: '灾难', patterns: ['灾难', '末日'] },
    { subName: '武侠', patterns: ['武侠', '江湖'] },
    { subName: '古装', patterns: ['古装', '古代', '宫廷'] },
    { subName: '传记', patterns: ['传记', '人物'] },
    { subName: '家庭', patterns: ['家庭', '亲情', '儿童'] },
    { subName: '伦理', patterns: ['伦理', '情感', '人性'] },
  ],
  2: [ // 电视剧子分类 - 按地区
    { subName: '国产剧', patterns: ['国产', '大陆', '内地', '中国'] },
    { subName: '韩剧', patterns: ['韩国', '韩剧'] },
    { subName: '日剧', patterns: ['日本', '日剧'] },
    { subName: '美剧', patterns: ['美国', '美剧', '欧美'] },
    { subName: '港台剧', patterns: ['港', '台湾', '港台', '香港'] },
    { subName: '泰剧', patterns: ['泰国', '泰剧'] },
    { subName: '英剧', patterns: ['英国', '英剧'] },
    // 按题材
    { subName: '都市', patterns: ['都市', '现代', '职场'] },
    { subName: '古装', patterns: ['古装', '古代', '宫廷'] },
    { subName: '悬疑', patterns: ['悬疑', '推理', '刑侦'] },
    { subName: '言情', patterns: ['言情', '爱情', '甜宠'] },
  ],
  3: [ // 综艺子分类
    { subName: '大陆综艺', patterns: ['大陆', '内地', '国产'] },
    { subName: '港台综艺', patterns: ['港', '台湾', '港台'] },
    { subName: '日韩综艺', patterns: ['日本', '韩国', '日韩'] },
    { subName: '欧美综艺', patterns: ['欧美', '美国'] },
    { subName: '晚会', patterns: ['晚会', '春晚', '跨年', '盛典'] },
    { subName: '真人秀', patterns: ['真人秀', '真人'] },
    { subName: '访谈', patterns: ['访谈', '脱口秀'] },
  ],
  4: [ // 动漫子分类
    { subName: '国产动漫', patterns: ['国产', '国漫', '大陆'] },
    { subName: '日本动漫', patterns: ['日本', '日漫', '新番', '番剧'] },
    { subName: '欧美动漫', patterns: ['欧美', '美国', '迪士尼'] },
    { subName: '热血', patterns: ['热血', '战斗', '格斗'] },
    { subName: '恋爱', patterns: ['恋爱', '爱情', '后宫'] },
    { subName: '校园', patterns: ['校园', '学园', '青春'] },
  ],
  5: [ // 短剧子分类
    { subName: '霸总', patterns: ['霸总', '总裁', '豪门'] },
    { subName: '战神', patterns: ['战神', '兵王', '特种'] },
    { subName: '古装', patterns: ['古装', '穿越', '宫廷'] },
    { subName: '甜宠', patterns: ['甜宠', '甜蜜', '恋爱'] },
    { subName: '都市', patterns: ['都市', '现代', '职场'] },
    { subName: '玄幻', patterns: ['玄幻', '修仙', '仙侠'] },
    { subName: '复仇', patterns: ['复仇', '报复', '逆袭'] },
    { subName: '重生', patterns: ['重生', '穿越'] },
    { subName: '萌宝', patterns: ['萌宝', '宝宝', '亲子'] },
  ],
  6: [ // 体育子分类
    { subName: '足球', patterns: ['足球', '世界杯', '欧冠', '英超', '西甲', '德甲', '意甲', '中超', '欧洲杯'] },
    { subName: '篮球', patterns: ['篮球', 'NBA', 'CBA', '男篮', '女篮'] },
    { subName: '网球', patterns: ['网球', '温网', '法网', '美网', '澳网'] },
    { subName: '台球', patterns: ['台球', '斯诺克', '桌球'] },
    { subName: '格斗', patterns: ['格斗', '拳击', 'UFC', 'MMA', '搏击'] },
    { subName: '电竞', patterns: ['电竞', '游戏', 'LOL', 'DOTA'] },
    { subName: '综合', patterns: ['体育', '赛事', '比赛', '直播', '奥运'] },
  ],
  7: [ // 纪录片子分类
    { subName: '历史', patterns: ['历史', '古代', '战争', '人物'] },
    { subName: '自然', patterns: ['自然', '动物', '植物', '地球'] },
    { subName: '科技', patterns: ['科技', '科学', '探索', '宇宙'] },
    { subName: '社会', patterns: ['社会', '人文', '文化'] },
    { subName: '美食', patterns: ['美食', '烹饪', '饮食'] },
  ],
  8: [ // 预告片子分类
    { subName: '电影预告', patterns: ['电影', '影片', '大片'] },
    { subName: '剧集预告', patterns: ['电视剧', '剧集', '网剧'] },
    { subName: '综艺预告', patterns: ['综艺', '真人秀'] },
    { subName: '影视解说', patterns: ['解说', '影视解说'] },
  ],
  9: [ // 福利子分类
    { subName: '伦理', patterns: ['伦理'] },
    { subName: '三级', patterns: ['三级', '港台三级'] },
    { subName: '写真', patterns: ['写真', '热舞'] },
    { subName: '两性', patterns: ['两性', '课堂'] },
  ],
};

/**
 * 基于 type_name 智能分类（核心函数）
 * 这是最可靠的分类方式，因为资源站已经做了分类
 */
export function classifyByTypeName(typeName: string): {
  typeId: number;
  typeName: string;
  subTypeName?: string;
  confidence: number;
} | null {
  if (!typeName || typeName.trim() === '') {
    return null;
  }
  
  const name = typeName.trim();
  
  // 按优先级遍历规则
  for (const rule of TYPE_NAME_RULES) {
    // 检查排除词
    if (rule.excludes) {
      const hasExclude = rule.excludes.some(ex => name.includes(ex));
      if (hasExclude) continue;
    }
    
    // 检查匹配词
    const matched = rule.patterns.some(pattern => name.includes(pattern));
    if (!matched) continue;
    
    // 匹配成功，尝试提取子分类
    let subTypeName: string | undefined;
    if (rule.subTypeExtract) {
      const subRules = SUB_TYPE_EXTRACT_RULES[rule.targetId];
      if (subRules) {
        for (const subRule of subRules) {
          if (subRule.patterns.some(p => name.includes(p))) {
            subTypeName = subRule.subName;
            break;
          }
        }
      }
    }
    
    return {
      typeId: rule.targetId,
      typeName: rule.targetName,
      subTypeName,
      confidence: 0.95, // type_name 匹配置信度很高
    };
  }
  
  return null;
}

/**
 * 从数据库加载分类映射
 */
export async function loadMappingsFromDb(env: { DB: D1Database }): Promise<Map<string, Map<string, number>>> {
  const now = Date.now();
  
  // 使用缓存
  if (dbMappingCache && (now - dbMappingCacheTime) < CACHE_TTL) {
    return dbMappingCache;
  }
  
  const mappings = new Map<string, Map<string, number>>();
  
  try {
    const result = await env.DB.prepare(`
      SELECT source_id, source_name, source_type_id, target_category_id
      FROM category_mappings
    `).all();
    
    for (const row of result.results as CategoryMappingRow[]) {
      const sourceKey = row.source_name?.toLowerCase() || `source_${row.source_id}`;
      
      if (!mappings.has(sourceKey)) {
        mappings.set(sourceKey, new Map());
      }
      
      mappings.get(sourceKey)!.set(String(row.source_type_id), row.target_category_id);
    }
    
    dbMappingCache = mappings;
    dbMappingCacheTime = now;
  } catch {
    // 表可能不存在，使用默认配置
    logger.classify.debug('category_mappings table not found, using defaults');
  }
  
  return mappings;
}

/**
 * 清除映射缓存（在更新映射后调用）
 */
export function clearMappingCache(): void {
  dbMappingCache = null;
  dbMappingCacheTime = 0;
  dbSubCategoryCache = null;
  dbSubCategoryCacheTime = 0;
}

// 子分类数据库缓存
export interface SubCategory {
  id: number;
  parentId: number;
  name: string;
  nameEn: string;
  keywords: string[];
}

let dbSubCategoryCache: SubCategory[] | null = null;
let dbSubCategoryCacheTime = 0;

/**
 * 从数据库加载子分类配置
 */
export async function loadSubCategoriesFromDb(env: { DB: D1Database }): Promise<SubCategory[]> {
  const now = Date.now();
  
  // 使用缓存
  if (dbSubCategoryCache && (now - dbSubCategoryCacheTime) < CACHE_TTL) {
    return dbSubCategoryCache;
  }
  
  const subCategories: SubCategory[] = [];
  
  try {
    const result = await env.DB.prepare(`
      SELECT id, parent_id, name, name_en, keywords
      FROM video_sub_categories
      WHERE is_active = 1
      ORDER BY parent_id, sort_order
    `).all();
    
    for (const row of result.results as SubCategoryRow[]) {
      subCategories.push({
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        nameEn: row.name_en || '',
        keywords: (row.keywords || '').split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean),
      });
    }
    
    dbSubCategoryCache = subCategories;
    dbSubCategoryCacheTime = now;
  } catch {
    // 表可能不存在，使用默认配置
    logger.classify.debug('video_sub_categories table not found, using defaults');
  }
  
  return subCategories;
}

/**
 * 根据内容识别子分类
 */
export function classifySubType(
  parentTypeId: number,
  content: {
    vodName: string;
    vodContent?: string;
    vodTag?: string;
    vodRemarks?: string;
  },
  dbSubCategories?: SubCategory[]
): { subTypeId?: number; subTypeName?: string; confidence: number } {
  const searchText = [
    content.vodName,
    content.vodContent || '',
    content.vodTag || '',
    content.vodRemarks || '',
  ].join(' ').toLowerCase();
  
  // 1. 优先使用数据库配置的子分类
  if (dbSubCategories && dbSubCategories.length > 0) {
    const parentSubs = dbSubCategories.filter(s => s.parentId === parentTypeId);
    
    for (const sub of parentSubs) {
      for (const keyword of sub.keywords) {
        if (keyword && searchText.includes(keyword)) {
          return {
            subTypeId: sub.id,
            subTypeName: sub.name,
            confidence: 0.85,
          };
        }
      }
    }
  }
  
  // 2. 使用硬编码的子分类关键词作为后备
  const hardcodedSubs = SUB_TYPE_KEYWORDS[parentTypeId];
  if (hardcodedSubs) {
    for (const [subName, keywords] of Object.entries(hardcodedSubs)) {
      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return {
            subTypeName: subName,
            confidence: 0.7,
          };
        }
      }
    }
  }
  
  return { confidence: 0 };
}

/**
 * 资源站分类映射表（硬编码默认值，作为后备）
 * 将不同资源站的分类ID映射到标准分类
 */
const SOURCE_TYPE_MAPPING: Record<string, Record<string, number>> = {
  // 非凡资源（完整映射）
  'ffzy': {
    '1': 1,   // 电影
    '2': 2,   // 电视剧
    '3': 3,   // 综艺
    '4': 4,   // 动漫
    '5': 5,   // 短剧
    '6': 1,   // 动作片 -> 电影
    '7': 1,   // 喜剧片 -> 电影
    '8': 1,   // 爱情片 -> 电影
    '9': 1,   // 科幻片 -> 电影
    '10': 1,  // 恐怖片 -> 电影
    '11': 1,  // 剧情片 -> 电影
    '12': 1,  // 战争片 -> 电影
    '13': 2,  // 国产剧 -> 电视剧
    '14': 2,  // 港台剧 -> 电视剧
    '15': 2,  // 日韩剧 -> 电视剧
    '16': 2,  // 欧美剧 -> 电视剧
    '17': 2,  // 泰剧 -> 电视剧
    '18': 2,  // 其他剧 -> 电视剧
    '19': 2,  // 海外剧 -> 电视剧
    '20': 3,  // 大陆综艺 -> 综艺
    '21': 3,  // 港台综艺 -> 综艺
    '22': 3,  // 日韩综艺 -> 综艺
    '23': 3,  // 欧美综艺 -> 综艺
    '24': 4,  // 国产动漫 -> 动漫
    '25': 4,  // 日韩动漫 -> 动漫
    '26': 4,  // 欧美动漫 -> 动漫
    '27': 4,  // 港台动漫 -> 动漫
    '28': 4,  // 海外动漫 -> 动漫
    '29': 4,  // 国漫 -> 动漫
    '30': 5,  // 短剧
    '31': 5,  // 微短剧
    '32': 5,  // 竖屏短剧
    '33': 5,  // 霸总短剧
    '34': 5,  // 战神短剧
    '35': 5,  // 古装短剧
    '36': 5,  // 短剧（通用）
    '37': 5,  // 甜宠短剧
    '38': 5,  // 都市短剧
    '39': 5,  // 玄幻短剧
    '40': 5,  // 其他短剧
  },
  // 量子资源（扩展映射）
  'lz': {
    '1': 1,   // 电影
    '2': 2,   // 电视剧
    '3': 3,   // 综艺
    '4': 4,   // 动漫
    '5': 5,   // 短剧
    '6': 1,   // 动作片
    '7': 1,   // 喜剧片
    '8': 1,   // 爱情片
    '9': 1,   // 科幻片
    '10': 1,  // 恐怖片
    '11': 1,  // 剧情片
    '12': 1,  // 战争片
    '13': 2,  // 国产剧
    '14': 2,  // 港台剧
    '15': 2,  // 日韩剧
    '16': 2,  // 欧美剧
    '20': 3,  // 综艺
    '21': 4,  // 动漫
    '36': 5,  // 短剧
  },
  // 新浪资源（常见映射）
  'xinlang': {
    '1': 1,   // 电影
    '2': 2,   // 电视剧
    '3': 3,   // 综艺
    '4': 4,   // 动漫
    '5': 5,   // 短剧
    '36': 5,  // 短剧
  },
  // 默认映射（智能推断）
  'default': {
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '36': 5,
  },
};

/**
 * 分类关键词（增强版）
 * 用于根据视频名称智能识别分类
 */
const TYPE_KEYWORDS = {
  1: [ // 电影
    '电影', '影片', '大片', '院线', '票房', '剧场版',
  ],
  2: [ // 电视剧
    '电视剧', '连续剧', '剧集', '全集', '更新至', '共', '集',
    '第', '季', 'season', 's0', 's1', 's2', 's3',
  ],
  3: [ // 综艺
    '综艺', '真人秀', '访谈', '选秀', '晚会', '歌会', '演唱会',
    '音乐节', '跨年', '春晚', '中秋', '元宵', '盛典',
    '好声音', '好歌曲', '歌手', '偶像练习生', '创造营',
    '奔跑吧', '极限挑战', '向往的生活', '快乐大本营',
    '天天向上', '非诚勿扰', '中国好', '我是歌手',
    '跑男', '极挑', '明星大侦探', '密室大逃脱',
  ],
  4: [ // 动漫
    '动漫', '动画', '番剧', '国漫', '日漫', '海贼王', '火影忍者',
    '名侦探柯南', '龙珠', '妖精的尾巴', '刀剑神域',
    '进击的巨人', '鬼灭之刃', '咒术回战', '间谍过家家',
  ],
  5: [ // 短剧
    '短剧', '微短剧', '竖屏', '霸总', '战神', '闪婚',
    '重生', '逆袭', '神医', '赘婿', '龙王',
  ],
};

/**
 * 子分类关键词
 */
const SUB_TYPE_KEYWORDS: Record<number, Record<string, string[]>> = {
  1: { // 电影
    '动作': ['动作', '打斗', '武打', '功夫', '枪战'],
    '喜剧': ['喜剧', '搞笑', '幽默', '爆笑'],
    '爱情': ['爱情', '浪漫', '恋爱', '情侣'],
    '科幻': ['科幻', '未来', '太空', '机器人'],
    '恐怖': ['恐怖', '惊悚', '鬼片', '丧尸'],
    '悬疑': ['悬疑', '推理', '侦探', '破案'],
    '战争': ['战争', '军事', '抗战', '二战'],
    '犯罪': ['犯罪', '黑帮', '毒品', '警匪'],
  },
  2: { // 电视剧
    '都市': ['都市', '现代', '职场', '白领'],
    '古装': ['古装', '古代', '宫廷', '武侠'],
    '悬疑': ['悬疑', '推理', '破案', '刑侦'],
    '言情': ['言情', '爱情', '浪漫', '甜宠'],
  },
  5: { // 短剧
    '霸总': ['霸总', '总裁', 'CEO', '豪门'],
    '战神': ['战神', '兵王', '特种兵', '退伍'],
    '古装': ['古装', '穿越', '重生', '宫斗'],
    '甜宠': ['甜宠', '恋爱', '浪漫', '甜蜜'],
  },
};

/**
 * 统一分类ID
 * 将资源站的分类ID映射到标准分类
 * 优先使用数据库配置，其次使用硬编码默认值
 */
export function normalizeTypeId(
  sourceTypeId: string | number,
  sourceName?: string,
  dbMappings?: Map<string, Map<string, number>>
): number {
  const typeIdStr = String(sourceTypeId);
  
  // 1. 优先从数据库映射查找
  if (dbMappings && sourceName) {
    const lowerName = sourceName.toLowerCase();
    
    // 尝试精确匹配
    for (const [key, mapping] of dbMappings) {
      if (lowerName.includes(key) || key.includes(lowerName)) {
        const targetId = mapping.get(typeIdStr);
        if (targetId !== undefined) {
          return targetId;
        }
      }
    }
  }
  
  // 2. 从硬编码映射表查找
  if (sourceName) {
    const lowerName = sourceName.toLowerCase();
    let sourceKey = 'default';
    
    if (lowerName.includes('ffzy') || lowerName.includes('非凡')) {
      sourceKey = 'ffzy';
    } else if (lowerName.includes('lz') || lowerName.includes('量子')) {
      sourceKey = 'lz';
    } else if (lowerName.includes('xinlang') || lowerName.includes('新浪')) {
      sourceKey = 'xinlang';
    }
    
    const mapping = SOURCE_TYPE_MAPPING[sourceKey];
    if (mapping && mapping[typeIdStr]) {
      return mapping[typeIdStr];
    }
  }
  
  // 3. 使用默认映射
  const defaultMapping = SOURCE_TYPE_MAPPING['default'];
  if (defaultMapping[typeIdStr]) {
    return defaultMapping[typeIdStr];
  }
  
  // 4. 如果都找不到，根据ID范围智能推断
  const numId = parseInt(typeIdStr);
  if (numId >= 6 && numId <= 12) return 1;   // 6-12: 电影子分类
  if (numId >= 13 && numId <= 19) return 2;  // 13-19: 电视剧子分类
  if (numId >= 20 && numId <= 23) return 3;  // 20-23: 综艺子分类
  if (numId >= 24 && numId <= 29) return 4;  // 24-29: 动漫子分类
  if (numId >= 30 && numId <= 40) return 5;  // 30-40: 短剧子分类
  
  // 默认返回电影
  return 1;
}

/**
 * 根据视频名称智能识别分类（增强版）
 */
export function classifyByName(vodName: string): {
  typeId: number;
  typeName: string;
  subType?: string;
  confidence: number;
} {
  const name = vodName.toLowerCase();
  
  // 1. 优先检查短剧特征（短剧关键词权重最高）
  for (const keyword of TYPE_KEYWORDS[5]) {
    if (name.includes(keyword.toLowerCase())) {
      return {
        typeId: 5,
        typeName: '短剧',
        confidence: 0.95,
      };
    }
  }
  
  // 2. 检查综艺特征（综艺通常有明确的节目名）
  for (const keyword of TYPE_KEYWORDS[3]) {
    if (name.includes(keyword.toLowerCase())) {
      return {
        typeId: 3,
        typeName: '综艺',
        confidence: 0.9,
      };
    }
  }
  
  // 3. 检查动漫特征
  for (const keyword of TYPE_KEYWORDS[4]) {
    if (name.includes(keyword.toLowerCase())) {
      return {
        typeId: 4,
        typeName: '动漫',
        confidence: 0.9,
      };
    }
  }
  
  // 4. 检查电视剧特征（集数、季数等）
  const tvPatterns = [
    /第\s*\d+\s*季/,
    /\d+\s*集/,
    /更新至/,
    /全\s*\d+\s*集/,
    /共\s*\d+\s*集/,
    /s\d+e\d+/i,
    /season\s*\d+/i,
  ];
  
  for (const pattern of tvPatterns) {
    if (pattern.test(name)) {
      return {
        typeId: 2,
        typeName: '电视剧',
        confidence: 0.85,
      };
    }
  }
  
  // 5. 检查子分类关键词（同时确定主分类）
  for (const [typeId, subTypes] of Object.entries(SUB_TYPE_KEYWORDS)) {
    for (const [subType, keywords] of Object.entries(subTypes)) {
      for (const keyword of keywords) {
        if (name.includes(keyword.toLowerCase())) {
          return {
            typeId: parseInt(typeId),
            typeName: getTypeName(parseInt(typeId)),
            subType,
            confidence: 0.8,
          };
        }
      }
    }
  }
  
  // 6. 检查电影关键词
  for (const keyword of TYPE_KEYWORDS[1]) {
    if (name.includes(keyword.toLowerCase())) {
      return {
        typeId: 1,
        typeName: '电影',
        confidence: 0.7,
      };
    }
  }
  
  // 7. 默认为电影（置信度较低）
  return {
    typeId: 1,
    typeName: '电影',
    confidence: 0.5,
  };
}

/**
 * 根据演员/导演推断分类
 */
export function classifyByActor(actor: string, director: string): {
  typeId?: number;
  confidence: number; // 置信度 0-1
} {
  // 知名电影导演
  const movieDirectors = [
    '张艺谋', '陈凯歌', '冯小刚', '徐克', '吴宇森',
    '姜文', '贾樟柯', '王家卫', '李安', '侯孝贤',
  ];
  
  // 知名电视剧导演
  const tvDirectors = [
    '郑晓龙', '孔笙', '刘江', '毛卫宁', '张黎',
  ];
  
  // 知名电影演员
  const movieActors = [
    '成龙', '李连杰', '甄子丹', '周润发', '刘德华',
    '梁朝伟', '周星驰', '吴京', '黄渤', '沈腾',
  ];
  
  // 知名电视剧演员
  const tvActors = [
    '孙俪', '赵丽颖', '杨幂', '刘涛', '海清',
    '靳东', '胡歌', '王凯', '张嘉益', '陈道明',
  ];
  
  // 检查导演
  if (director) {
    for (const d of movieDirectors) {
      if (director.includes(d)) {
        return { typeId: 1, confidence: 0.8 };
      }
    }
    
    for (const d of tvDirectors) {
      if (director.includes(d)) {
        return { typeId: 2, confidence: 0.8 };
      }
    }
  }
  
  // 检查演员
  if (actor) {
    for (const a of movieActors) {
      if (actor.includes(a)) {
        return { typeId: 1, confidence: 0.7 };
      }
    }
    
    for (const a of tvActors) {
      if (actor.includes(a)) {
        return { typeId: 2, confidence: 0.7 };
      }
    }
  }
  
  return { confidence: 0 };
}

/**
 * 综合分类（V2 增强版）
 * 
 * 分类策略优先级：
 * 1. type_name 智能识别（最可靠，资源站已分类）
 * 2. 内容关键词识别（补充验证）
 * 3. type_id 映射（兜底）
 * 
 * @param video 视频信息
 * @param dbMappings 可选的数据库映射配置
 * @param dbSubCategories 可选的数据库子分类配置
 */
export function autoClassify(
  video: {
    vod_name: string;
    vod_actor?: string;
    vod_director?: string;
    vod_content?: string;
    vod_remarks?: string;
    vod_tag?: string;
    type_id?: number | string;
    type_name?: string;
    source_name?: string;
  },
  dbMappings?: Map<string, Map<string, number>>,
  dbSubCategories?: SubCategory[]
): {
  typeId: number;
  typeName: string;
  subTypeId?: number;
  subTypeName?: string;
  confidence: number;
  classifyMethod?: string; // 记录分类方法，便于调试
} {
  const name = video.vod_name.toLowerCase();
  const content = (video.vod_content || '').toLowerCase();
  const remarks = (video.vod_remarks || '').toLowerCase();
  
  // 辅助函数：构建带子分类的返回结果
  const buildResult = (
    typeId: number, 
    typeName: string, 
    confidence: number,
    method: string,
    presetSubTypeName?: string
  ) => {
    // 优先使用预设的子分类名（从 type_name 提取的）
    let subTypeId: number | undefined;
    let subTypeName = presetSubTypeName;
    
    // 如果没有预设子分类，尝试从数据库或关键词识别
    if (!subTypeName) {
      const subResult = classifySubType(typeId, {
        vodName: video.vod_name,
        vodContent: video.vod_content,
        vodTag: video.vod_tag,
        vodRemarks: video.vod_remarks,
      }, dbSubCategories);
      subTypeId = subResult.subTypeId;
      subTypeName = subResult.subTypeName;
    } else if (dbSubCategories) {
      // 有预设子分类名，尝试匹配数据库中的子分类ID
      const matchedSub = dbSubCategories.find(
        s => s.parentId === typeId && s.name === subTypeName
      );
      if (matchedSub) {
        subTypeId = matchedSub.id;
      }
    }
    
    return {
      typeId,
      typeName,
      subTypeId,
      subTypeName,
      confidence,
      classifyMethod: method,
    };
  };

  // ========================================
  // 策略1: 基于 type_name 智能识别（最优先）
  // ========================================
  if (video.type_name) {
    const typeNameResult = classifyByTypeName(video.type_name);
    if (typeNameResult) {
      // type_name 识别成功，但需要用内容特征验证/增强
      let finalConfidence = typeNameResult.confidence;
      
      // 如果是电视剧，检查是否有集数信息来增强置信度
      if (typeNameResult.typeId === 2) {
        const hasEpisodeInfo = /\d+\s*集|更新至|第.+季|season|s\d+e\d+/i.test(name + remarks);
        finalConfidence = hasEpisodeInfo ? 0.98 : 0.9;
      }
      
      // 如果是电影，检查是否有"正片"等标记
      if (typeNameResult.typeId === 1) {
        const isMovie = /正片|高清|蓝光|4k|hdr/i.test(remarks);
        finalConfidence = isMovie ? 0.98 : 0.92;
      }
      
      return buildResult(
        typeNameResult.typeId,
        typeNameResult.typeName,
        finalConfidence,
        'type_name',
        typeNameResult.subTypeName
      );
    }
  }

  // ========================================
  // 策略2: 基于内容关键词识别
  // ========================================
  
  // 2.1 短剧特征（短剧关键词权重最高）
  const shortsDramaKeywords = ['短剧', '微短剧', '竖屏', '霸总', '战神', '闪婚', '重生', '逆袭', '神医', '赘婿', '龙王'];
  for (const keyword of shortsDramaKeywords) {
    if (name.includes(keyword) || content.includes(keyword) || remarks.includes(keyword)) {
      return buildResult(5, '短剧', 0.95, 'keyword_shorts');
    }
  }
  
  // 2.2 综艺特征
  const varietyKeywords = ['综艺', '真人秀', '访谈', '选秀', '晚会', '演唱会', '跨年', '春晚', '好声音', '歌手', '奔跑吧', '极限挑战'];
  for (const keyword of varietyKeywords) {
    if (name.includes(keyword) || content.includes(keyword)) {
      return buildResult(3, '综艺', 0.92, 'keyword_variety');
    }
  }
  
  // 2.3 动漫特征
  const animeKeywords = ['动漫', '动画', '番剧', '国漫', '日漫', '海贼王', '火影', '柯南', '龙珠', '鬼灭', 'ova'];
  for (const keyword of animeKeywords) {
    if (name.includes(keyword) || content.includes(keyword)) {
      return buildResult(4, '动漫', 0.92, 'keyword_anime');
    }
  }
  
  // 2.4 电视剧特征（集数、季数等）
  const tvPatterns = [
    /第\s*\d+\s*季/,
    /\d+\s*集/,
    /更新至/,
    /全\s*\d+\s*集/,
    /共\s*\d+\s*集/,
    /s\d+e\d+/i,
    /season\s*\d+/i,
  ];
  
  for (const pattern of tvPatterns) {
    if (pattern.test(name) || pattern.test(remarks)) {
      return buildResult(2, '电视剧', 0.88, 'pattern_tv');
    }
  }

  // ========================================
  // 策略3: 基于 type_id 映射（兜底）
  // ========================================
  if (video.type_id) {
    const normalizedTypeId = normalizeTypeId(video.type_id, video.source_name, dbMappings);
    const typeName = getTypeName(normalizedTypeId);
    
    // 短剧、综艺、动漫的 type_id 映射相对可靠
    if (normalizedTypeId === 5 || normalizedTypeId === 3 || normalizedTypeId === 4) {
      return buildResult(normalizedTypeId, typeName, 0.8, 'type_id_mapping');
    }
    
    // 电影和电视剧需要进一步验证
    if (normalizedTypeId === 2) {
      const hasEpisodeInfo = /\d+\s*集|更新|season|s\d+/i.test(name + remarks);
      return buildResult(2, '电视剧', hasEpisodeInfo ? 0.8 : 0.6, 'type_id_mapping');
    }
    
    if (normalizedTypeId === 1) {
      return buildResult(1, '电影', 0.7, 'type_id_mapping');
    }
  }
  
  // ========================================
  // 策略4: 演员/导演推断
  // ========================================
  const actorResult = classifyByActor(
    video.vod_actor || '',
    video.vod_director || ''
  );
  
  if (actorResult.confidence > 0.7 && actorResult.typeId) {
    return buildResult(actorResult.typeId, getTypeName(actorResult.typeId), actorResult.confidence, 'actor_director');
  }
  
  // ========================================
  // 策略5: 名称关键词分类
  // ========================================
  const nameResult = classifyByName(video.vod_name);
  if (nameResult.confidence > 0.6) {
    return buildResult(nameResult.typeId, nameResult.typeName, nameResult.confidence, 'name_keyword');
  }
  
  // ========================================
  // 最终兜底：默认电影
  // ========================================
  return buildResult(1, '电影', 0.4, 'default');
}

/**
 * 获取分类名称
 */
function getTypeName(typeId: number): string {
  const names: Record<number, string> = {
    1: '电影',
    2: '电视剧',
    3: '综艺',
    4: '动漫',
    5: '短剧',
    6: '体育',
    7: '纪录片',
    8: '预告片',
    9: '福利',
  };
  return names[typeId] || '电影';
}

/**
 * 批量分类
 */
export function batchClassify(videos: VideoClassifyInput[], dbSubCategories?: SubCategory[]): ClassifyResult[] {
  return videos.map(video => {
    const classification = autoClassify(video, undefined, dbSubCategories);
    return {
      typeId: classification.typeId,
      typeName: classification.typeName,
      subTypeId: classification.subTypeId,
      subTypeName: classification.subTypeName,
      confidence: classification.confidence,
      classifyMethod: classification.classifyMethod,
    };
  });
}
