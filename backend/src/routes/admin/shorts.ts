/**
 * Admin Shorts API
 * 短剧管理相关接口
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';

const shorts = new Hono<{ Bindings: Bindings }>();

/**
 * GET /admin/shorts/stats
 */
shorts.get('/admin/shorts/stats', async (c) => {
  try {
    const totalResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache WHERE type_id = 5 AND is_valid = 1
    `).first();
    
    const previewResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache 
      WHERE type_id = 5 AND is_valid = 1 AND shorts_preview_url IS NOT NULL
    `).first();
    
    const categoryResult = await c.env.DB.prepare(`
      SELECT shorts_category as category, COUNT(*) as count
      FROM vod_cache WHERE type_id = 5 AND is_valid = 1
      GROUP BY shorts_category ORDER BY count DESC
    `).all();
    
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        totalShorts: (totalResult?.count as number) || 0,
        withPreview: (previewResult?.count as number) || 0,
        categories: categoryResult.results,
      },
    });
  } catch (error) {
    logger.admin.error('Get shorts stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get shorts stats' }, 500);
  }
});

/**
 * POST /admin/shorts/migrate
 */
shorts.post('/admin/shorts/migrate', async (c) => {
  try {
    const { migrateShortsPreview } = await import('../../scripts/migrate_shorts_preview');
    await migrateShortsPreview(c.env);
    
    const { migrateShortsSubtype } = await import('../../scripts/migrate_shorts_subtype');
    const subtypeResult = await migrateShortsSubtype(c.env);
    
    return c.json({ code: 1, msg: 'Migration completed successfully', data: { subtype: subtypeResult } });
  } catch (error) {
    logger.admin.error('Shorts migration error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Migration failed' }, 500);
  }
});

/**
 * POST /admin/shorts/refresh-preview
 */
shorts.post('/admin/shorts/refresh-preview', async (c) => {
  try {
    // 定义短剧行类型
    interface ShortsRow {
      vod_id: string;
      vod_play_url: string | null;
    }
    
    const shorts = await c.env.DB.prepare(`
      SELECT vod_id, vod_play_url FROM vod_cache WHERE type_id = 5 AND is_valid = 1
    `).all();
    
    let updated = 0;
    for (const short of shorts.results as ShortsRow[]) {
      const preview = selectPreviewEpisode(short.vod_play_url || '');
      if (preview.url) {
        await c.env.DB.prepare(`
          UPDATE vod_cache SET shorts_preview_episode = ?, shorts_preview_url = ? WHERE vod_id = ?
        `).bind(preview.episode, preview.url, short.vod_id).run();
        updated++;
      }
    }
    
    return c.json({ code: 1, msg: 'Preview refresh completed', data: { updated } });
  } catch (error) {
    logger.admin.error('[Admin] Refresh preview error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to refresh preview' }, 500);
  }
});

/**
 * POST /admin/shorts/reclassify
 */
shorts.post('/admin/shorts/reclassify', async (c) => {
  try {
    // 定义短剧分类行类型
    interface ShortsClassifyRow {
      vod_id: string;
      vod_name: string;
      vod_content: string | null;
      vod_tag: string | null;
    }
    
    const result = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, vod_content, vod_tag FROM vod_cache WHERE type_id = 5
    `).all();
    
    let updated = 0;
    for (const short of result.results as ShortsClassifyRow[]) {
      const newCategory = classifyShortsCategory({
        vod_name: short.vod_name,
        vod_content: short.vod_content || '',
        vod_tag: short.vod_tag || '',
      });
      
      await c.env.DB.prepare(`UPDATE vod_cache SET shorts_category = ? WHERE vod_id = ?`)
        .bind(newCategory, short.vod_id).run();
      updated++;
    }
    
    return c.json({ code: 1, msg: 'Shorts reclassification completed', data: { updated } });
  } catch (error) {
    logger.admin.error('[Admin] Reclassify error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to reclassify shorts' }, 500);
  }
});

/**
 * POST /admin/clear-shorts
 */
shorts.post('/admin/clear-shorts', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      UPDATE vod_cache SET shorts_preview_episode = NULL, shorts_preview_url = NULL, shorts_category = NULL WHERE type_id = 5
    `).run();
    
    return c.json({ code: 1, msg: 'Shorts preview cleared.', data: { cleared: result.meta.changes || 0 } });
  } catch (error) {
    logger.admin.error('[Admin] Clear shorts error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to clear shorts' }, 500);
  }
});

// 辅助函数
const SHORTS_CATEGORY_RULES: Record<string, string[]> = {
  霸总: ['霸总', '总裁', '豪门', '首富', '富豪', '千金', '继承人', '集团', '董事长', 'CEO'],
  战神: ['战神', '兵王', '龙王', '战尊', '特种兵', '雇佣兵', '退伍', '归来', '无敌', '至尊'],
  古装: ['古装', '穿越', '重生', '王爷', '皇上', '公主', '太子', '宫廷', '江湖', '武侠', '仙侠'],
  都市: ['都市', '职场', '白领', '创业', '逆袭', '打脸', '系统', '神医', '赘婿'],
  甜宠: ['甜宠', '恋爱', '暗恋', '初恋', '校园', '青春', '闪婚', '契约', '萌宝', '娇妻'],
  复仇: ['复仇', '重生', '归来', '报仇', '雪耻', '逆袭', '虐渣', '前妻', '前夫'],
  玄幻: ['玄幻', '修仙', '仙侠', '武侠', '异能', '超能力', '系统', '金手指', '神豪'],
};

function classifyShortsCategory(info: { vod_name: string; vod_content?: string; vod_tag?: string }): string {
  const text = `${info.vod_name} ${info.vod_content || ''} ${info.vod_tag || ''}`.toLowerCase();
  let maxScore = 0;
  let bestCategory = '其他';
  
  for (const [category, keywords] of Object.entries(SHORTS_CATEGORY_RULES)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += info.vod_name.toLowerCase().includes(keyword.toLowerCase()) ? 3 : 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }
  return maxScore > 0 ? bestCategory : '其他';
}

function selectPreviewEpisode(vodPlayUrl: string): { episode: number; url: string } {
  if (!vodPlayUrl) return { episode: 1, url: '' };
  
  try {
    const parsed = JSON.parse(vodPlayUrl);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      const firstSource = Object.values(parsed)[0];
      
      // 新格式：值是数组 [{ name, url }]
      if (Array.isArray(firstSource) && firstSource.length > 0) {
        const episodes = (firstSource as Array<{ name: string; url: string }>)
          .filter(ep => ep.url && ep.url.startsWith('http'));
        
        if (episodes.length === 0) return { episode: 1, url: '' };
        
        const minEp = Math.min(3, episodes.length);
        const maxEp = Math.min(8, episodes.length);
        const targetIndex = minEp - 1 + Math.floor(Math.random() * (maxEp - minEp + 1));
        
        const selected = episodes[targetIndex] || episodes[0];
        return { episode: targetIndex + 1, url: selected.url };
      }
    }
  } catch (e) {
    // JSON 解析失败
  }
  
  return { episode: 1, url: '' };
}

export default shorts;
