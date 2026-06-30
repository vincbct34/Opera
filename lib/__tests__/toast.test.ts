/* eslint-disable */
import { describe, expect, test, jest } from '@jest/globals';

jest.mock('@/components/ui/Toast', () => ({
  showToast: jest.fn(),
}));

const toast = require('../utils/toast').default;
const { showToast } = require('@/components/ui/Toast');

describe('toast utility', () => {
  test('calls showToast with correct args', () => {
    // @ts-ignore
    toast('hello', 'success');
    // @ts-ignore
    expect(showToast).toHaveBeenCalledWith('hello', 'success');
  });
});
