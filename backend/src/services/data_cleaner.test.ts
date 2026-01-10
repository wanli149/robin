/**
 * Data Cleaner Service Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  cleanPlayUrls,
  parseEpisodes,
  upgradeToHttps,
  cleanImageUrl,
  toPlaySources,
  extractFirstUrl,
  mergeCleanedPlayUrls,
  type CleanedPlayUrls,
  type RawPlayUrls,
} from './data_cleaner';

describe('upgradeToHttps', () => {
  it('should upgrade http to https', () => {
    expect(upgradeToHttps('http://example.com/video.m3u8')).toBe('https://example.com/video.m3u8');
  });

  it('should keep https unchanged', () => {
    expect(upgradeToHttps('https://example.com/video.m3u8')).toBe('https://example.com/video.m3u8');
  });

  it('should handle empty string', () => {
    expect(upgradeToHttps('')).toBe('');
  });

  it('should handle non-http urls', () => {
    expect(upgradeToHttps('ftp://example.com')).toBe('ftp://example.com');
  });
});

describe('parseEpisodes', () => {
  it('should parse standard format with $ separator', () => {
    const raw = '第1集$http://a.com/1.m3u8#第2集$http://a.com/2.m3u8';
    const result = parseEpisodes(raw);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: '第1集', url: 'https://a.com/1.m3u8' });
    expect(result[1]).toEqual({ name: '第2集', url: 'https://a.com/2.m3u8' });
  });

  it('should handle urls without $ separator', () => {
    const raw = 'http://a.com/1.m3u8#http://a.com/2.m3u8';
    const result = parseEpisodes(raw);
    
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('第1集');
    expect(result[1].name).toBe('第2集');
  });

  it('should filter invalid urls', () => {
    const raw = '第1集$http://valid.com/1.m3u8#第2集$invalid-url';
    const result = parseEpisodes(raw);
    
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://valid.com/1.m3u8');
  });

  it('should handle empty string', () => {
    expect(parseEpisodes('')).toEqual([]);
  });

  it('should upgrade http to https', () => {
    const raw = '第1集$http://a.com/1.m3u8';
    const result = parseEpisodes(raw);
    
    expect(result[0].url).toBe('https://a.com/1.m3u8');
  });
});

describe('cleanPlayUrls', () => {
  it('should clean raw play urls', () => {
    const raw: RawPlayUrls = {
      '资源站A': '第1集$http://a.com/1.m3u8#第2集$http://a.com/2.m3u8',
      '资源站B': '第1集$http://b.com/1.m3u8',
    };
    
    const result = cleanPlayUrls(raw);
    
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['资源站A']).toHaveLength(2);
    expect(result['资源站B']).toHaveLength(1);
  });

  it('should skip empty or invalid entries', () => {
    const raw: RawPlayUrls = {
      '有效': '第1集$http://a.com/1.m3u8',
      '空值': '',
    };
    
    const result = cleanPlayUrls(raw);
    
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['有效']).toBeDefined();
    expect(result['空值']).toBeUndefined();
  });
});

describe('cleanImageUrl', () => {
  it('should upgrade http to https', () => {
    expect(cleanImageUrl('http://img.example.com/cover.jpg')).toBe('https://img.example.com/cover.jpg');
  });

  it('should handle empty string', () => {
    expect(cleanImageUrl('')).toBe('');
  });
});

describe('toPlaySources', () => {
  it('should convert cleaned urls to play sources array', () => {
    const cleaned: CleanedPlayUrls = {
      '资源站A': [{ name: '第1集', url: 'https://a.com/1.m3u8' }],
      '资源站B': [{ name: '第1集', url: 'https://b.com/1.m3u8' }],
    };
    
    const result = toPlaySources(cleaned);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('episodes');
  });
});

describe('extractFirstUrl', () => {
  it('should extract first url from cleaned format', () => {
    const cleaned: CleanedPlayUrls = {
      '资源站A': [
        { name: '第1集', url: 'https://a.com/1.m3u8' },
        { name: '第2集', url: 'https://a.com/2.m3u8' },
      ],
    };
    
    expect(extractFirstUrl(cleaned)).toBe('https://a.com/1.m3u8');
  });

  it('should handle JSON string input', () => {
    const cleaned = JSON.stringify({
      '资源站A': [{ name: '第1集', url: 'https://a.com/1.m3u8' }],
    });
    
    expect(extractFirstUrl(cleaned)).toBe('https://a.com/1.m3u8');
  });

  it('should return null for empty input', () => {
    expect(extractFirstUrl(null)).toBeNull();
    expect(extractFirstUrl(undefined)).toBeNull();
    expect(extractFirstUrl({})).toBeNull();
  });
});

describe('mergeCleanedPlayUrls', () => {
  it('should merge two cleaned play urls', () => {
    const existing: CleanedPlayUrls = {
      '资源站A': [{ name: '第1集', url: 'https://a.com/1.m3u8' }],
    };
    const newUrls: CleanedPlayUrls = {
      '资源站B': [{ name: '第1集', url: 'https://b.com/1.m3u8' }],
    };
    
    const result = mergeCleanedPlayUrls(existing, newUrls);
    
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['资源站A']).toBeDefined();
    expect(result['资源站B']).toBeDefined();
  });

  it('should keep existing source when duplicate', () => {
    const existing: CleanedPlayUrls = {
      '资源站A': [{ name: '第1集', url: 'https://a.com/old.m3u8' }],
    };
    const newUrls: CleanedPlayUrls = {
      '资源站A': [{ name: '第1集', url: 'https://a.com/new.m3u8' }],
    };
    
    const result = mergeCleanedPlayUrls(existing, newUrls);
    
    expect(result['资源站A'][0].url).toBe('https://a.com/old.m3u8');
  });
});
