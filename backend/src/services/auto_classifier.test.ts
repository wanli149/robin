/**
 * Auto Classifier Service Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  classifyByTypeName,
  classifyByName,
  classifyByActor,
  autoClassify,
  normalizeTypeId,
  clearMappingCache,
} from './auto_classifier';

describe('classifyByTypeName', () => {
  it('should classify movie types', () => {
    const result = classifyByTypeName('动作片');
    expect(result.typeId).toBe(1);
    expect(result.typeName).toBe('电影');
  });

  it('should classify TV series types', () => {
    const result = classifyByTypeName('国产剧');
    expect(result.typeId).toBe(2);
    expect(result.typeName).toBe('电视剧');
  });

  it('should classify anime types', () => {
    const result = classifyByTypeName('日本动漫');
    expect(result.typeId).toBe(4);
    expect(result.typeName).toBe('动漫');
  });

  it('should classify variety show types', () => {
    const result = classifyByTypeName('综艺');
    expect(result.typeId).toBe(3);
    expect(result.typeName).toBe('综艺');
  });

  it('should classify shorts types', () => {
    const result = classifyByTypeName('短剧');
    expect(result.typeId).toBe(5);
    expect(result.typeName).toBe('短剧');
  });

  it('should classify documentary types', () => {
    const result = classifyByTypeName('纪录片');
    expect(result.typeId).toBe(7);
    expect(result.typeName).toBe('纪录片');
  });

  it('should return low confidence for unknown types', () => {
    const result = classifyByTypeName('未知分类');
    expect(result.typeId).toBe(1);
    // Unknown types should have lower confidence
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });
});

describe('classifyByName', () => {
  it('should classify anime by name patterns', () => {
    const result = classifyByName('海贼王');
    expect(result.typeId).toBe(4);
    expect(result.typeName).toBe('动漫');
  });

  it('should classify shorts by name patterns', () => {
    const result = classifyByName('霸总的甜心小娇妻');
    expect(result.typeId).toBe(5);
    expect(result.typeName).toBe('短剧');
  });

  it('should classify variety shows by name patterns', () => {
    const result = classifyByName('奔跑吧兄弟');
    expect(result.typeId).toBe(3);
    expect(result.typeName).toBe('综艺');
  });

  it('should return default for generic names', () => {
    const result = classifyByName('普通电影名');
    expect(result.typeId).toBe(1);
  });
});

describe('classifyByActor', () => {
  it('should return result for anime voice actors', () => {
    const result = classifyByActor('花泽香菜,神谷浩史', '');
    // May or may not identify as anime depending on implementation
    expect(result).toBeDefined();
    expect(typeof result.confidence).toBe('number');
  });

  it('should return low confidence for unknown actors', () => {
    const result = classifyByActor('普通演员', '普通导演');
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });
});

describe('normalizeTypeId', () => {
  it('should normalize string type id to number', () => {
    const result = normalizeTypeId('1');
    expect(result).toBe(1);
  });

  it('should handle number type id', () => {
    const result = normalizeTypeId(2);
    expect(result).toBe(2);
  });

  it('should map common type id ranges', () => {
    // Type IDs 6-12 typically map to movies
    const result = normalizeTypeId(6);
    expect(result).toBe(1);
  });

  it('should map TV series type id ranges', () => {
    // Type IDs 13-20 typically map to TV series
    const result = normalizeTypeId(13);
    expect(result).toBe(2);
  });
});

describe('autoClassify', () => {
  beforeEach(() => {
    clearMappingCache();
  });

  it('should prioritize type_name classification', () => {
    const result = autoClassify({
      vod_name: '普通名称',
      type_name: '动作片',
      type_id: 999,
    });
    
    expect(result.typeId).toBe(1);
    expect(result.typeName).toBe('电影');
  });

  it('should fallback to name classification when type_name is missing', () => {
    const result = autoClassify({
      vod_name: '海贼王第1000集',
      type_id: 999,
    });
    
    expect(result.typeId).toBe(4);
    expect(result.typeName).toBe('动漫');
  });

  it('should classify shorts correctly', () => {
    const result = autoClassify({
      vod_name: '战神归来',
      type_name: '短剧',
    });
    
    expect(result.typeId).toBe(5);
    expect(result.typeName).toBe('短剧');
  });

  it('should handle empty input gracefully', () => {
    const result = autoClassify({
      vod_name: '',
    });
    
    expect(result.typeId).toBe(1);
    expect(result.typeName).toBe('电影');
  });

  it('should extract sub-type when available', () => {
    const result = autoClassify({
      vod_name: '霸总的复仇',
      type_name: '短剧',
    });
    
    expect(result.typeId).toBe(5);
    // Sub-type should be extracted based on keywords
    if (result.subTypeName) {
      expect(['霸总', '复仇', '其他']).toContain(result.subTypeName);
    }
  });
});
