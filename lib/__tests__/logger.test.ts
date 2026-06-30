/* eslint-disable */
import { describe, beforeEach, jest, afterAll, it, expect } from '@jest/globals';

describe('logger', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('calls console methods appropriately in development', () => {
    (process.env as any).NODE_ENV = 'development';

    // Require fresh instance after setting env
    const { logger } = require('../middleware/logger');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    logger.log('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    logger.debug('e');
    logger.security('sec', { foo: 'bar' });
    // also call without data to hit the data || '' branch
    logger.security('sec-no-data');

    expect(logSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();

    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('does not call development-only methods in production', () => {
    (process.env as any).NODE_ENV = 'production';
    const { logger } = require('../middleware/logger');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    logger.log('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    logger.debug('e');
    logger.security('sec', { foo: 'bar' });

    // dev-only should not be called
    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();

    // warn and error always called
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
