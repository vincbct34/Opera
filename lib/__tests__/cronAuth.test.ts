import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { isAuthorizedCronRequest, requireCronAuth } from '../middleware/cronAuth';
import * as validateSecrets from '../config/validateSecrets';
import * as loggerModule from '../middleware/logger';
import { NextResponse, NextRequest } from 'next/server';

// Mock dependencies
jest.mock('../config/validateSecrets');
jest.mock('../middleware/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(url: string, headers: Record<string, string>): any {
  const headersMap = new Map(Object.entries(headers));
  return {
    url,
    headers: {
      get: (key: string) => headersMap.get(key) || null,
    },
  };
}

describe('cronAuth - isAuthorizedCronRequest', () => {
  const mockValidateCronSecret = validateSecrets.validateCronSecret as jest.MockedFunction<
    typeof validateSecrets.validateCronSecret
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true for valid cron token with Bearer format', () => {
    mockValidateCronSecret.mockReturnValue(true);

    const mockReq = {
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return 'Bearer valid-secret-token';
          return null;
        },
      },
    } as unknown as NextRequest;

    const result = isAuthorizedCronRequest(mockReq);

    expect(result).toBe(true);
  });

  it('should return true for valid cron token without Bearer format', () => {
    mockValidateCronSecret.mockReturnValue(true);

    const mockReq = {
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return 'valid-secret-token';
          return null;
        },
      },
    } as unknown as NextRequest;

    const result = isAuthorizedCronRequest(mockReq);

    expect(result).toBe(true);
  });

  it('should return false for invalid cron token', () => {
    mockValidateCronSecret.mockReturnValue(false);

    const mockReq = {
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return 'invalid-token';
          return null;
        },
      },
    } as unknown as NextRequest;

    const result = isAuthorizedCronRequest(mockReq);

    expect(result).toBe(false);
  });

  it('should return false when no authorization header', () => {
    mockValidateCronSecret.mockReturnValue(false);

    const mockReq = {
      headers: {
        get: () => null,
      },
    } as unknown as NextRequest;

    const result = isAuthorizedCronRequest(mockReq);

    expect(result).toBe(false);
  });

  it('should extract Bearer token correctly for validation', () => {
    mockValidateCronSecret.mockReturnValue(true);

    const mockReq = {
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return 'Bearer my-secret-token-123';
          return null;
        },
      },
    } as unknown as NextRequest;

    isAuthorizedCronRequest(mockReq);

    // Verify that validateCronSecret was called with the token without "Bearer "
    expect(mockValidateCronSecret).toHaveBeenCalledWith('my-secret-token-123');
  });
});

describe('cronAuth - requireCronAuth', () => {
  const mockValidateCronSecret = validateSecrets.validateCronSecret as jest.MockedFunction<
    typeof validateSecrets.validateCronSecret
  >;
  const mockLogger = loggerModule.logger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call handler when valid token with Bearer format is provided', async () => {
    mockValidateCronSecret.mockReturnValue(true);

    const mockHandler = jest.fn(async () => NextResponse.json({ success: true })) as jest.Mock;

    const mockReq = createMockRequest('http://localhost:3000/api/cron/test', {
      authorization: 'Bearer valid-token',
    });

    const response = await requireCronAuth(
      mockReq as unknown as NextRequest,
      mockHandler as unknown as (req: NextRequest) => Promise<NextResponse>,
    );

    expect(mockValidateCronSecret).toHaveBeenCalledWith('valid-token');
    expect(mockHandler).toHaveBeenCalledWith(mockReq);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });
  });

  it('should call handler when valid token without Bearer format is provided', async () => {
    mockValidateCronSecret.mockReturnValue(true);

    const mockHandler = jest.fn(async () => NextResponse.json({ data: 'test' })) as jest.Mock;

    const mockReq = createMockRequest('http://localhost:3000/api/cron/test', {
      authorization: 'my-secret-token',
    });

    const response = await requireCronAuth(
      mockReq as unknown as NextRequest,
      mockHandler as unknown as (req: NextRequest) => Promise<NextResponse>,
    );

    expect(mockValidateCronSecret).toHaveBeenCalledWith('my-secret-token');
    expect(mockHandler).toHaveBeenCalledWith(mockReq);
    expect(response.status).toBe(200);
  });

  it('should return 401 when invalid token is provided', async () => {
    mockValidateCronSecret.mockReturnValue(false);

    const mockHandler = jest.fn();

    const mockReq = createMockRequest('http://localhost:3000/api/cron/test', {
      authorization: 'invalid-token',
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'Test Agent',
    });

    const response = await requireCronAuth(
      mockReq as unknown as NextRequest,
      mockHandler as unknown as (req: NextRequest) => Promise<NextResponse>,
    );

    expect(mockValidateCronSecret).toHaveBeenCalledWith('invalid-token');
    expect(mockHandler).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Unauthorized cron access attempt', {
      ip: '192.168.1.1',
      userAgent: 'Test Agent',
      path: '/api/cron/test',
    });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Unauthorized',
      message: 'Invalid or missing cron authentication token',
    });
  });

  it('should return 401 when no authorization header is provided', async () => {
    mockValidateCronSecret.mockReturnValue(false);

    const mockHandler = jest.fn();

    const mockReq = createMockRequest('http://localhost:3000/api/cron/test', {
      'x-real-ip': '10.0.0.1',
      'user-agent': 'Bot',
    });

    const response = await requireCronAuth(
      mockReq as unknown as NextRequest,
      mockHandler as unknown as (req: NextRequest) => Promise<NextResponse>,
    );

    expect(mockValidateCronSecret).toHaveBeenCalledWith(null);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Unauthorized cron access attempt', {
      ip: '10.0.0.1',
      userAgent: 'Bot',
      path: '/api/cron/test',
    });
    expect(response.status).toBe(401);
  });

  it('should use x-real-ip header when x-forwarded-for is not available', async () => {
    mockValidateCronSecret.mockReturnValue(false);

    const mockHandler = jest.fn();

    const mockReq = createMockRequest('http://localhost:3000/api/cron/test', {
      authorization: 'bad-token',
      'x-real-ip': '172.16.0.1',
    });

    await requireCronAuth(
      mockReq as unknown as NextRequest,
      mockHandler as unknown as (req: NextRequest) => Promise<NextResponse>,
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unauthorized cron access attempt',
      expect.objectContaining({
        ip: '172.16.0.1',
      }),
    );
  });

  it('should return 500 when handler throws an error', async () => {
    mockValidateCronSecret.mockReturnValue(true);

    const testError = new Error('Handler error');
    const mockHandler = jest.fn(async () => {
      throw testError;
    });

    const mockReq = createMockRequest('http://localhost:3000/api/cron/test', {
      authorization: 'Bearer valid-token',
    });

    const response = await requireCronAuth(
      mockReq as unknown as NextRequest,
      mockHandler as unknown as (req: NextRequest) => Promise<NextResponse>,
    );

    expect(mockLogger.error).toHaveBeenCalledWith('Error in cron authentication:', testError);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Authentication error',
    });
  });

  it('should return 500 when validation throws an error', async () => {
    const testError = new Error('Validation error');
    mockValidateCronSecret.mockImplementation(() => {
      throw testError;
    });

    const mockHandler = jest.fn();

    const mockReq = createMockRequest('http://localhost:3000/api/cron/test', {
      authorization: 'Bearer valid-token',
    });

    const response = await requireCronAuth(
      mockReq as unknown as NextRequest,
      mockHandler as unknown as (req: NextRequest) => Promise<NextResponse>,
    );

    expect(mockHandler).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith('Error in cron authentication:', testError);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Internal Server Error',
      message: 'Authentication error',
    });
  });
});
