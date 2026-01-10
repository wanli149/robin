/**
 * JWT Utilities Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken, extractToken } from './jwt';

const TEST_SECRET = 'test-secret-key-for-unit-tests';

describe('generateToken', () => {
  it('should generate a valid JWT token', async () => {
    const payload = {
      user_id: 1,
      username: 'testuser',
      is_vip: false,
    };
    
    const token = await generateToken(payload, TEST_SECRET);
    
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);
  });

  it('should generate different tokens for different payloads', async () => {
    const payload1 = { user_id: 1, username: 'user1', is_vip: false };
    const payload2 = { user_id: 2, username: 'user2', is_vip: true };
    
    const token1 = await generateToken(payload1, TEST_SECRET);
    const token2 = await generateToken(payload2, TEST_SECRET);
    
    expect(token1).not.toBe(token2);
  });

  it('should respect custom expiration time', async () => {
    const payload = { user_id: 1, username: 'testuser', is_vip: false };
    const shortExpiry = 60; // 1 minute
    
    const token = await generateToken(payload, TEST_SECRET, shortExpiry);
    const verified = await verifyToken(token, TEST_SECRET);
    
    expect(verified).not.toBeNull();
    expect(verified!.exp - verified!.iat).toBe(shortExpiry);
  });
});

describe('verifyToken', () => {
  it('should verify a valid token', async () => {
    const payload = {
      user_id: 123,
      username: 'testuser',
      is_vip: true,
    };
    
    const token = await generateToken(payload, TEST_SECRET);
    const verified = await verifyToken(token, TEST_SECRET);
    
    expect(verified).not.toBeNull();
    expect(verified!.user_id).toBe(123);
    expect(verified!.username).toBe('testuser');
    expect(verified!.is_vip).toBe(true);
  });

  it('should reject token with wrong secret', async () => {
    const payload = { user_id: 1, username: 'testuser', is_vip: false };
    const token = await generateToken(payload, TEST_SECRET);
    
    const verified = await verifyToken(token, 'wrong-secret');
    
    expect(verified).toBeNull();
  });

  it('should reject malformed token', async () => {
    const verified = await verifyToken('invalid.token', TEST_SECRET);
    expect(verified).toBeNull();
  });

  it('should reject token with only two parts', async () => {
    const verified = await verifyToken('header.payload', TEST_SECRET);
    expect(verified).toBeNull();
  });

  it('should reject expired token', async () => {
    const payload = { user_id: 1, username: 'testuser', is_vip: false };
    // Generate token that expires immediately (negative expiry)
    const token = await generateToken(payload, TEST_SECRET, -1);
    
    const verified = await verifyToken(token, TEST_SECRET);
    
    expect(verified).toBeNull();
  });
});

describe('extractToken', () => {
  it('should extract token from Bearer header', () => {
    const token = extractToken('Bearer eyJhbGciOiJIUzI1NiJ9.test.signature');
    expect(token).toBe('eyJhbGciOiJIUzI1NiJ9.test.signature');
  });

  it('should return null for null header', () => {
    expect(extractToken(null)).toBeNull();
  });

  it('should return null for empty header', () => {
    expect(extractToken('')).toBeNull();
  });

  it('should return null for non-Bearer header', () => {
    expect(extractToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('should return null for malformed Bearer header', () => {
    expect(extractToken('Bearer')).toBeNull();
    expect(extractToken('Bearer token extra')).toBeNull();
  });
});
