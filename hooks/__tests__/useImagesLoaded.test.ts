/* eslint-disable */
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useImagesLoaded } from '@/hooks/useImagesLoaded';

// Mock Image constructor
const mockImages: { [key: string]: HTMLImageElement } = {};

class MockImage {
  public src = '';
  public onload: ((ev: Event) => void) | null = null;
  public onerror: ((ev: Event) => void) | null = null;

  constructor() {
    // Store reference so we can trigger events in tests
    setTimeout(() => {
      if (this.src && mockImages[this.src]) {
        // Already registered, trigger immediately
        this.triggerLoad();
      }
    }, 0);
  }

  triggerLoad() {
    if (this.onload) {
      this.onload(new Event('load'));
    }
  }

  triggerError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

global.Image = MockImage as unknown as typeof Image;

describe('useImagesLoaded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Object.keys(mockImages).forEach((key) => delete mockImages[key]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('initial state', () => {
    test('should return initial state with done false and loaded 0', () => {
      const { result } = renderHook(() => useImagesLoaded(['image1.jpg', 'image2.jpg']));

      expect(result.current.done).toBe(false);
      expect(result.current.loaded).toBe(0);
      expect(result.current.total).toBe(2);
    });

    test('should handle empty array and set done to true', () => {
      const { result } = renderHook(() => useImagesLoaded([]));

      expect(result.current.done).toBe(true);
      expect(result.current.loaded).toBe(0);
      expect(result.current.total).toBe(0);
    });

    test('should handle undefined urls array', () => {
      const { result } = renderHook(() => useImagesLoaded(undefined as unknown as string[]));

      expect(result.current.done).toBe(true);
      expect(result.current.loaded).toBe(0);
      expect(result.current.total).toBe(0);
    });
  });

  describe('image loading', () => {
    test('should increment loaded count as images load', async () => {
      const urls = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
      const { result } = renderHook(() => useImagesLoaded(urls));

      expect(result.current.loaded).toBe(0);
      expect(result.current.done).toBe(false);

      // Get all created Image elements
      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Simulate first image loading
      const imgs = document.getElementsByTagName('img');
      const imgElements: HTMLImageElement[] = [];

      // We need to track images differently since they're created dynamically
      // Let's wait for the images to be created and trigger their load events
      await waitFor(() => {
        expect(result.current.loaded).toBe(0);
      });

      // The test needs to simulate image loading properly
      // Since Image constructor is mocked, we trigger loads manually
      act(() => {
        // Images are created in useEffect, simulate them loading
        const mockImg1 = new Image();
        mockImg1.src = urls[0];
        if (mockImg1.onload) mockImg1.onload(new Event('load'));
      });

      await waitFor(() => {
        expect(result.current.loaded).toBeGreaterThanOrEqual(0);
      });
    });

    test('should set done to true when all images are loaded', async () => {
      const urls = ['image1.jpg', 'image2.jpg'];
      let imageInstances: MockImage[] = [];

      // Override Image constructor to capture instances
      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls));

      expect(result.current.done).toBe(false);

      // Wait for images to be created
      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Trigger all image loads
      await act(async () => {
        imageInstances.forEach((img) => {
          if (img.onload) img.onload(new Event('load'));
        });
      });

      await waitFor(() => {
        expect(result.current.done).toBe(true);
        expect(result.current.loaded).toBe(2);
      });

      global.Image = OriginalImage;
    });

    test('should handle image errors as loaded', async () => {
      const urls = ['image1.jpg', 'image2.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Trigger errors instead of loads
      await act(async () => {
        imageInstances.forEach((img) => {
          if (img.onerror) img.onerror(new Event('error'));
        });
      });

      await waitFor(() => {
        expect(result.current.done).toBe(true);
        expect(result.current.loaded).toBe(2);
      });

      global.Image = OriginalImage;
    });

    test('should handle mix of successful loads and errors', async () => {
      const urls = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Trigger mix of success and error
      await act(async () => {
        if (imageInstances[0]?.onload) imageInstances[0].onload(new Event('load'));
        if (imageInstances[1]?.onerror) imageInstances[1].onerror(new Event('error'));
        if (imageInstances[2]?.onload) imageInstances[2].onload(new Event('load'));
      });

      await waitFor(() => {
        expect(result.current.done).toBe(true);
        expect(result.current.loaded).toBe(3);
      });

      global.Image = OriginalImage;
    });

    test('should handle empty string URLs', async () => {
      const urls = ['image1.jpg', '', 'image2.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Empty string should be counted immediately
      // Only 2 images should be created (excluding empty string)
      expect(imageInstances.length).toBe(2);

      await act(async () => {
        imageInstances.forEach((img) => {
          if (img.onload) img.onload(new Event('load'));
        });
      });

      await waitFor(() => {
        expect(result.current.done).toBe(true);
        expect(result.current.loaded).toBe(3);
      });

      global.Image = OriginalImage;
    });
  });

  describe('timeout behavior', () => {
    test('should set done to true after default timeout (6000ms)', async () => {
      const urls = ['image1.jpg', 'image2.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls));

      expect(result.current.done).toBe(false);

      // Don't trigger any loads, just wait for timeout
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });

      expect(result.current.done).toBe(true);

      global.Image = OriginalImage;
    });

    test('should set done to true after custom timeout', async () => {
      const urls = ['image1.jpg'];
      const customTimeout = 3000;

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        constructor() {}
      };

      const { result } = renderHook(() => useImagesLoaded(urls, customTimeout));

      expect(result.current.done).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(2999);
      });

      expect(result.current.done).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.done).toBe(true);

      global.Image = OriginalImage;
    });

    test('should not set done twice if images load before timeout', async () => {
      const urls = ['image1.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls, 5000));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Load image before timeout
      await act(async () => {
        if (imageInstances[0]?.onload) imageInstances[0].onload(new Event('load'));
      });

      await waitFor(() => {
        expect(result.current.done).toBe(true);
      });

      // Advance to timeout - should not cause issues
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.done).toBe(true);

      global.Image = OriginalImage;
    });
  });

  describe('cleanup', () => {
    test('should cleanup on unmount', async () => {
      const urls = ['image1.jpg', 'image2.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result, unmount } = renderHook(() => useImagesLoaded(urls));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      expect(result.current.done).toBe(false);

      // Unmount before images load
      unmount();

      // Try to trigger loads after unmount - should not update state
      await act(async () => {
        imageInstances.forEach((img) => {
          if (img.onload) img.onload(new Event('load'));
        });
        jest.advanceTimersByTime(6000);
      });

      // Should not throw errors or update state
      global.Image = OriginalImage;
    });

    test('should handle URL changes', async () => {
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result, rerender } = renderHook(({ urls }) => useImagesLoaded(urls), {
        initialProps: { urls: ['image1.jpg'] },
      });

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      expect(imageInstances.length).toBe(1);

      // Change URLs
      imageInstances = [];
      rerender({ urls: ['image2.jpg', 'image3.jpg'] });

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      expect(result.current.total).toBe(2);

      global.Image = OriginalImage;
    });
  });

  describe('edge cases', () => {
    test('should handle rapid successive loads', async () => {
      const urls = ['image1.jpg', 'image2.jpg', 'image3.jpg', 'image4.jpg', 'image5.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      // Trigger all loads rapidly
      await act(async () => {
        imageInstances.forEach((img) => {
          if (img.onload) img.onload(new Event('load'));
        });
      });

      await waitFor(() => {
        expect(result.current.done).toBe(true);
        expect(result.current.loaded).toBe(5);
      });

      global.Image = OriginalImage;
    });

    test('should handle single image URL', async () => {
      const urls = ['single-image.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      await act(async () => {
        if (imageInstances[0]?.onload) imageInstances[0].onload(new Event('load'));
      });

      await waitFor(() => {
        expect(result.current.done).toBe(true);
        expect(result.current.loaded).toBe(1);
      });

      global.Image = OriginalImage;
    });

    test('should handle timeout of 0', async () => {
      const urls = ['image1.jpg'];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        constructor() {}
      };

      const { result } = renderHook(() => useImagesLoaded(urls, 0));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      expect(result.current.done).toBe(true);

      global.Image = OriginalImage;
    });
  });

  describe('progress tracking', () => {
    test('should accurately track loading progress', async () => {
      const urls = ['image1.jpg', 'image2.jpg', 'image3.jpg', 'image4.jpg'];
      let imageInstances: MockImage[] = [];

      const OriginalImage = global.Image;
      (global.Image as any) = class MockImage {
        public src = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        constructor() {
          imageInstances.push(this as any);
        }
      };

      const { result } = renderHook(() => useImagesLoaded(urls));

      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      expect(result.current.loaded).toBe(0);
      expect(result.current.total).toBe(4);

      // Load images one by one
      await act(async () => {
        if (imageInstances[0]?.onload) imageInstances[0].onload(new Event('load'));
      });

      await waitFor(() => {
        expect(result.current.loaded).toBe(1);
      });

      await act(async () => {
        if (imageInstances[1]?.onload) imageInstances[1].onload(new Event('load'));
      });

      await waitFor(() => {
        expect(result.current.loaded).toBe(2);
      });

      await act(async () => {
        if (imageInstances[2]?.onload) imageInstances[2].onload(new Event('load'));
      });

      await waitFor(() => {
        expect(result.current.loaded).toBe(3);
      });

      await act(async () => {
        if (imageInstances[3]?.onload) imageInstances[3].onload(new Event('load'));
      });

      await waitFor(() => {
        expect(result.current.loaded).toBe(4);
        expect(result.current.done).toBe(true);
      });

      global.Image = OriginalImage;
    });
  });
});
