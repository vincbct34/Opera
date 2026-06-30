/**
 * Tests for Help Widget types
 * Validates type definitions and their structure
 */

import {
  isValidHelpContent,
  isValidHelpSection,
  type HelpSection,
  type HelpFAQ,
  type HelpLink,
  type HelpContent,
  type HelpContentsMap,
} from '../types';
import { describe, it, expect } from '@jest/globals';

describe('Help Widget Types', () => {
  describe('HelpSection', () => {
    it('should accept valid HelpSection object', () => {
      const section: HelpSection = {
        title: 'Test Section',
        content: 'Test content',
        steps: ['step 1', 'step 2'],
      };

      expect(section.title).toBe('Test Section');
      expect(section.content).toBe('Test content');
      expect(section.steps).toEqual(['step 1', 'step 2']);
    });

    it('should accept HelpSection without optional steps', () => {
      const section: HelpSection = {
        title: 'Test Section',
        content: 'Test content',
      };

      expect(section.title).toBe('Test Section');
      expect(section.content).toBe('Test content');
      expect(section.steps).toBeUndefined();
    });

    it('should accept HelpSection with empty steps array', () => {
      const section: HelpSection = {
        title: 'Test Section',
        content: 'Test content',
        steps: [],
      };

      expect(section.steps).toEqual([]);
    });
  });

  describe('HelpFAQ', () => {
    it('should accept valid HelpFAQ object', () => {
      const faq: HelpFAQ = {
        question: 'Test question?',
        answer: 'Test answer',
      };

      expect(faq.question).toBe('Test question?');
      expect(faq.answer).toBe('Test answer');
    });

    it('should accept FAQ with empty strings', () => {
      const faq: HelpFAQ = {
        question: '',
        answer: '',
      };

      expect(faq.question).toBe('');
      expect(faq.answer).toBe('');
    });
  });

  describe('HelpLink', () => {
    it('should accept valid HelpLink object', () => {
      const link: HelpLink = {
        label: 'Test Link',
        href: '/test/path',
        description: 'Test description',
      };

      expect(link.label).toBe('Test Link');
      expect(link.href).toBe('/test/path');
      expect(link.description).toBe('Test description');
    });

    it('should accept HelpLink without optional description', () => {
      const link: HelpLink = {
        label: 'Test Link',
        href: '/test/path',
      };

      expect(link.label).toBe('Test Link');
      expect(link.href).toBe('/test/path');
      expect(link.description).toBeUndefined();
    });

    it('should accept HelpLink with external URL', () => {
      const link: HelpLink = {
        label: 'External Link',
        href: 'https://example.com',
        description: 'External resource',
      };

      expect(link.href).toBe('https://example.com');
    });
  });

  describe('HelpContent', () => {
    const createMinimalHelpContent = (): HelpContent => ({
      pageId: 'test-page',
      pageName: 'Test Page',
      title: 'Test Title',
      description: 'Test Description',
      sections: [
        {
          title: 'Section 1',
          content: 'Content 1',
        },
      ],
    });

    it('should accept valid HelpContent object', () => {
      const content: HelpContent = {
        ...createMinimalHelpContent(),
        faq: [
          {
            question: 'Question 1',
            answer: 'Answer 1',
          },
        ],
        relatedLinks: [
          {
            label: 'Link 1',
            href: '/link1',
            description: 'Description 1',
          },
        ],
        tips: ['Tip 1', 'Tip 2'],
      };

      expect(content.pageId).toBe('test-page');
      expect(content.pageName).toBe('Test Page');
      expect(content.title).toBe('Test Title');
      expect(content.description).toBe('Test Description');
      expect(content.sections).toHaveLength(1);
      expect(content.faq).toHaveLength(1);
      expect(content.relatedLinks).toHaveLength(1);
      expect(content.tips).toHaveLength(2);
    });

    it('should accept minimal HelpContent without optional fields', () => {
      const content: HelpContent = createMinimalHelpContent();

      expect(content.pageId).toBe('test-page');
      expect(content.faq).toBeUndefined();
      expect(content.relatedLinks).toBeUndefined();
      expect(content.tips).toBeUndefined();
    });

    it('should accept HelpContent with empty optional arrays', () => {
      const content: HelpContent = {
        ...createMinimalHelpContent(),
        faq: [],
        relatedLinks: [],
        tips: [],
      };

      expect(content.faq).toEqual([]);
      expect(content.relatedLinks).toEqual([]);
      expect(content.tips).toEqual([]);
    });

    it('should accept HelpContent with sections containing steps', () => {
      const content: HelpContent = {
        ...createMinimalHelpContent(),
        sections: [
          {
            title: 'Section with steps',
            content: 'Content',
            steps: ['Step 1', 'Step 2', 'Step 3'],
          },
        ],
      };

      expect(content.sections[0].steps).toEqual(['Step 1', 'Step 2', 'Step 3']);
    });

    it('should accept HelpContent with multiple sections', () => {
      const content: HelpContent = {
        ...createMinimalHelpContent(),
        sections: [
          { title: 'Section 1', content: 'Content 1' },
          { title: 'Section 2', content: 'Content 2', steps: ['Step 1'] },
          { title: 'Section 3', content: 'Content 3', steps: [] },
        ],
      };

      expect(content.sections).toHaveLength(3);
    });
  });

  describe('HelpContentsMap', () => {
    it('should accept valid HelpContentsMap object', () => {
      const map: HelpContentsMap = {
        'page-1': {
          pageId: 'page-1',
          pageName: 'Page 1',
          title: 'Title 1',
          description: 'Description 1',
          sections: [{ title: 'Section 1', content: 'Content 1' }],
        },
        'page-2': {
          pageId: 'page-2',
          pageName: 'Page 2',
          title: 'Title 2',
          description: 'Description 2',
          sections: [{ title: 'Section 2', content: 'Content 2' }],
          faq: [{ question: 'Q', answer: 'A' }],
          relatedLinks: [{ label: 'Link', href: '/link' }],
          tips: ['Tip'],
        },
      };

      expect(Object.keys(map)).toHaveLength(2);
      expect(map['page-1']).toBeDefined();
      expect(map['page-2']).toBeDefined();
    });

    it('should accept empty HelpContentsMap', () => {
      const map: HelpContentsMap = {};

      expect(Object.keys(map)).toHaveLength(0);
    });

    it('should allow indexed access to HelpContentsMap', () => {
      const content: HelpContent = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [],
      };
      const map: HelpContentsMap = {
        test: content,
      };

      expect(map['test']).toBe(content);
      expect(map['test']?.pageId).toBe('test');
    });
  });

  describe('isValidHelpContent', () => {
    it('should return true for valid HelpContent', () => {
      const content: HelpContent = {
        pageId: 'test-page',
        pageName: 'Test Page',
        title: 'Test Title',
        description: 'Test Description',
        sections: [
          {
            title: 'Section 1',
            content: 'Content 1',
          },
        ],
      };

      expect(isValidHelpContent(content)).toBe(true);
    });

    it('should return true for valid HelpContent with optional fields', () => {
      const content: HelpContent = {
        pageId: 'test-page',
        pageName: 'Test Page',
        title: 'Test Title',
        description: 'Test Description',
        sections: [
          {
            title: 'Section 1',
            content: 'Content 1',
            steps: ['step 1'],
          },
        ],
        faq: [{ question: 'Q?', answer: 'A' }],
        relatedLinks: [{ label: 'Link', href: '/link' }],
        tips: ['Tip 1'],
      };

      expect(isValidHelpContent(content)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidHelpContent(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidHelpContent(undefined)).toBe(false);
    });

    it('should return false for primitive types', () => {
      expect(isValidHelpContent('string')).toBe(false);
      expect(isValidHelpContent(123)).toBe(false);
      expect(isValidHelpContent(true)).toBe(false);
    });

    it('should return false for object without required fields', () => {
      expect(isValidHelpContent({})).toBe(false);
      expect(isValidHelpContent({ pageId: 'test' })).toBe(false);
      expect(isValidHelpContent({ pageId: 'test', pageName: 'Test' })).toBe(false);
      expect(isValidHelpContent({ pageId: 'test', pageName: 'Test', title: 'Test' })).toBe(false);
    });

    it('should return false when pageId is not a string', () => {
      const content = {
        pageId: 123,
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [],
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return false when sections is missing', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return false when sections is not an array', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: 'not an array',
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return false when section has invalid structure', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [{ title: 'Test' }], // missing content
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return false when section is null', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [null],
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return false when section is a primitive', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: ['string', 123, true],
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return false when section has steps that is not an array', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [{ title: 'Test', content: 'Content', steps: 'not an array' }],
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return true when section has empty steps array', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [{ title: 'Test', content: 'Content', steps: [] }],
      };

      expect(isValidHelpContent(content)).toBe(true);
    });

    it('should return false when faq is not an array', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [{ title: 'Test', content: 'Content' }],
        faq: 'not an array',
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return false when relatedLinks is not an array', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [{ title: 'Test', content: 'Content' }],
        relatedLinks: 'not an array',
      };

      expect(isValidHelpContent(content)).toBe(false);
    });

    it('should return false when tips is not an array', () => {
      const content = {
        pageId: 'test',
        pageName: 'Test',
        title: 'Test',
        description: 'Test',
        sections: [{ title: 'Test', content: 'Content' }],
        tips: 'not an array',
      };

      expect(isValidHelpContent(content)).toBe(false);
    });
  });

  describe('isValidHelpSection', () => {
    it('should return true for valid HelpSection', () => {
      const section: HelpSection = {
        title: 'Test Section',
        content: 'Test content',
      };

      expect(isValidHelpSection(section)).toBe(true);
    });

    it('should return true for valid HelpSection with steps', () => {
      const section: HelpSection = {
        title: 'Test Section',
        content: 'Test content',
        steps: ['step 1', 'step 2'],
      };

      expect(isValidHelpSection(section)).toBe(true);
    });

    it('should return true for HelpSection with empty steps array', () => {
      const section: HelpSection = {
        title: 'Test Section',
        content: 'Test content',
        steps: [],
      };

      expect(isValidHelpSection(section)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidHelpSection(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidHelpSection(undefined)).toBe(false);
    });

    it('should return false for primitive types', () => {
      expect(isValidHelpSection('string')).toBe(false);
      expect(isValidHelpSection(123)).toBe(false);
      expect(isValidHelpSection(true)).toBe(false);
    });

    it('should return false for object without title', () => {
      expect(isValidHelpSection({ content: 'Content' })).toBe(false);
    });

    it('should return false for object without content', () => {
      expect(isValidHelpSection({ title: 'Title' })).toBe(false);
    });

    it('should return false when title is not a string', () => {
      expect(isValidHelpSection({ title: 123, content: 'Content' })).toBe(false);
    });

    it('should return false when content is not a string', () => {
      expect(isValidHelpSection({ title: 'Title', content: 123 })).toBe(false);
    });

    it('should return false when steps is not an array', () => {
      const section = {
        title: 'Title',
        content: 'Content',
        steps: 'not an array',
      };

      expect(isValidHelpSection(section)).toBe(false);
    });
  });
});
