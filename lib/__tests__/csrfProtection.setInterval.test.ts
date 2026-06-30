/* eslint-disable */
/**
 * Test for csrfProtection setInterval undefined scenario
 * This file must be run in isolation to test the module loading with setInterval undefined
 */

import { describe, expect, it, jest, afterEach } from '@jest/globals';

describe('CSRF Protection - setInterval undefined on module load', () => {
  afterEach(() => {
    // Clean up any intervals that might have been created
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should handle module load when setInterval does not exist', () => {
    // Save original setInterval
    const originalSetInterval = (global as any).setInterval;

    try {
      // Delete setInterval BEFORE loading the module
      delete (global as any).setInterval;

      // Verify it's gone
      expect(typeof (global as any).setInterval).toBe('undefined');

      // Clear the module cache to force a fresh import
      jest.resetModules();

      // Now require the module - this should execute startCleanupInterval()
      // with setInterval === undefined
      const csrfModule = require('../auth/csrfProtection');

      // Module should load successfully
      expect(csrfModule).toBeDefined();
      expect(csrfModule.generateCSRFToken).toBeDefined();
      expect(csrfModule.validateCSRFToken).toBeDefined();
      expect(csrfModule.isSetIntervalAvailable).toBeDefined();

      // isSetIntervalAvailable should return false
      expect(csrfModule.isSetIntervalAvailable()).toBe(false);

      // startCleanupInterval should not throw
      expect(() => csrfModule.startCleanupInterval()).not.toThrow();
    } finally {
      // Always restore setInterval
      (global as any).setInterval = originalSetInterval;
      jest.resetModules();
    }
  });

  it('should handle repeated calls to startCleanupInterval without setInterval', () => {
    const originalSetInterval = (global as any).setInterval;

    try {
      delete (global as any).setInterval;
      jest.resetModules();

      const { startCleanupInterval, isSetIntervalAvailable } = require('../auth/csrfProtection');

      expect(isSetIntervalAvailable()).toBe(false);

      // Should not throw even when called multiple times
      expect(() => {
        startCleanupInterval();
        startCleanupInterval();
        startCleanupInterval();
      }).not.toThrow();
    } finally {
      (global as any).setInterval = originalSetInterval;
      jest.resetModules();
    }
  });

  it('should verify both branches of isSetIntervalAvailable', () => {
    const originalSetInterval = (global as any).setInterval;

    try {
      // Use fake timers to prevent actual intervals
      jest.useFakeTimers();

      // Test with setInterval undefined
      delete (global as any).setInterval;
      jest.resetModules();

      const csrfModule1 = require('../auth/csrfProtection');
      expect(csrfModule1.isSetIntervalAvailable()).toBe(false);

      // Restore and test with setInterval defined
      (global as any).setInterval = originalSetInterval;
      jest.resetModules();

      const csrfModule2 = require('../auth/csrfProtection');
      expect(csrfModule2.isSetIntervalAvailable()).toBe(true);

      // Stop any intervals that were created
      csrfModule2.stopCleanupInterval();
    } finally {
      (global as any).setInterval = originalSetInterval;
      jest.resetModules();
      jest.useRealTimers();
    }
  });
});
