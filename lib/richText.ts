import xss from 'xss';

const RICH_TEXT_WHITE_LIST = {
  p: [],
  br: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  ul: [],
  ol: [],
  li: [],
  a: ['href'],
} satisfies Record<string, string[]>;

const escapeAttributeValue = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Decode &amp; last so sequences like "&amp;lt;" do not collapse into "<"
    .replace(/&amp;/g, '&');

const normalizeRichTextInput = (html: string): string => {
  const normalizedBlocks = html
    .replace(/<\s*div(?:\s[^>]*)?>/gi, '<p>')
    .replace(/<\s*\/\s*div\s*>/gi, '</p>');

  if (/<[a-z][\s\S]*>/i.test(normalizedBlocks)) {
    return normalizedBlocks;
  }

  return normalizedBlocks.replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
};

export function richTextToPlainText(html?: string | null): string {
  if (!html) return '';

  const withLineBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*\/li\s*>/gi, '\n');

  return decodeHtmlEntities(
    xss(withLineBreaks, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
    }),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeRichText(html?: string | null): string {
  if (!html) return '';

  const sanitized = xss(normalizeRichTextInput(html.normalize('NFKC')), {
    whiteList: RICH_TEXT_WHITE_LIST,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
    onTagAttr(tag, name, value) {
      if (tag !== 'a' || name !== 'href') return undefined;

      const href = value.trim();
      if (/^(https?:|mailto:)/i.test(href) || href.startsWith('/')) {
        return `href="${escapeAttributeValue(href)}"`;
      }

      return '';
    },
  });

  if (!richTextToPlainText(sanitized)) return '';

  return sanitized
    .replace(/\0/g, '')
    .replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ')
    .trim();
}

export function prepareRichTextForEditing(html?: string | null): string {
  return sanitizeRichText(html);
}
