import { describe, expect, test } from '@jest/globals';
import { prepareRichTextForEditing, richTextToPlainText, sanitizeRichText } from '@/lib/richText';

describe('richText', () => {
  describe('sanitizeRichText', () => {
    test('returns an empty string for empty input', () => {
      expect(sanitizeRichText()).toBe('');
      expect(sanitizeRichText(null)).toBe('');
    });

    test('keeps supported formatting tags', () => {
      const html = '<p>Hello <strong>World</strong></p><ul><li><em>Item</em></li></ul>';

      expect(sanitizeRichText(html)).toBe(
        '<p>Hello <strong>World</strong></p><ul><li><em>Item</em></li></ul>',
      );
    });

    test('removes scripts and unsafe link targets', () => {
      const html =
        '<p>Text</p><script>alert(1)</script><a href="javascript:alert(1)">Bad</a><a href="https://example.com">Good</a>';

      const sanitized = sanitizeRichText(html);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('<a>Bad</a>');
      expect(sanitized).toContain(
        '<a target="_blank" rel="noopener noreferrer" href="https://example.com">Good</a>',
      );
    });

    test('drops unsupported attributes and escapes kept link targets', () => {
      const html =
        '<p data-extra="ignored">Text</p><a title="ignored" href="/path?a=1&b=<test>">Link</a>';

      expect(sanitizeRichText(html)).toBe(
        '<p>Text</p><a target="_blank" rel="noopener noreferrer" href="/path?a=1&amp;b=&lt;test&gt;">Link</a>',
      );
    });

    test('returns an empty string when the content has no text', () => {
      expect(sanitizeRichText('<p><br></p>')).toBe('');
    });

    test('normalizes contenteditable div blocks to paragraphs', () => {
      expect(sanitizeRichText('<div>Line one</div><div>Line two</div>')).toBe(
        '<p>Line one</p><p>Line two</p>',
      );
    });

    test('keeps plain text line breaks as br tags', () => {
      expect(sanitizeRichText('Line one\nLine two')).toBe('Line one<br>Line two');
    });
  });

  describe('prepareRichTextForEditing', () => {
    test('prepares legacy plain text descriptions for contenteditable rendering', () => {
      expect(prepareRichTextForEditing('Line one\nLine two')).toBe('Line one<br>Line two');
    });
  });

  describe('richTextToPlainText', () => {
    test('returns an empty string for empty input', () => {
      expect(richTextToPlainText()).toBe('');
      expect(richTextToPlainText(null)).toBe('');
    });

    test('converts rich text into readable plain text', () => {
      expect(richTextToPlainText('<p>Hello <strong>World</strong></p><ul><li>Item</li></ul>')).toBe(
        'Hello World\nItem',
      );
    });
  });
});
