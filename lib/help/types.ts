/**
 * Types for the Help Widget system
 * Provides contextual help content for pages throughout the application
 */

export interface HelpSection {
  title: string;
  content: string;
  steps?: string[];
}

export interface HelpFAQ {
  question: string;
  answer: string;
}

export interface HelpLink {
  label: string;
  href: string;
  description?: string;
}

export interface HelpContent {
  // Page identification
  pageId: string;
  pageName: string;

  // Main content
  title: string;
  description: string;

  // Structured sections
  sections: HelpSection[];

  // Optional FAQ
  faq?: HelpFAQ[];

  // Optional related pages
  relatedLinks?: HelpLink[];

  // Optional tips
  tips?: string[];
}

// Type for the help contents index
export type HelpContentsMap = Record<string, HelpContent>;

/**
 * Validates if an object is a valid HelpContent
 * @param content - The object to validate
 * @returns true if the object is a valid HelpContent, false otherwise
 */
export function isValidHelpContent(content: unknown): content is HelpContent {
  if (typeof content !== 'object' || content === null) {
    return false;
  }

  const c = content as Partial<HelpContent>;

  // Check required string fields
  if (
    typeof c.pageId !== 'string' ||
    typeof c.pageName !== 'string' ||
    typeof c.title !== 'string' ||
    typeof c.description !== 'string'
  ) {
    return false;
  }

  // Check sections array
  if (!Array.isArray(c.sections)) {
    return false;
  }

  // Validate each section
  for (const section of c.sections) {
    if (typeof section !== 'object' || section === null) {
      return false;
    }
    if (typeof section.title !== 'string' || typeof section.content !== 'string') {
      return false;
    }
    // steps is optional, but if present must be an array of strings
    if ('steps' in section && section.steps !== undefined && !Array.isArray(section.steps)) {
      return false;
    }
  }

  // Validate optional FAQ array
  if (c.faq !== undefined && !Array.isArray(c.faq)) {
    return false;
  }

  // Validate optional relatedLinks array
  if (c.relatedLinks !== undefined && !Array.isArray(c.relatedLinks)) {
    return false;
  }

  // Validate optional tips array
  if (c.tips !== undefined && !Array.isArray(c.tips)) {
    return false;
  }

  return true;
}

/**
 * Validates if an object is a valid HelpSection
 * @param section - The object to validate
 * @returns true if the object is a valid HelpSection, false otherwise
 */
export function isValidHelpSection(section: unknown): section is HelpSection {
  if (typeof section !== 'object' || section === null) {
    return false;
  }

  const s = section as Partial<HelpSection>;

  if (typeof s.title !== 'string' || typeof s.content !== 'string') {
    return false;
  }

  // steps is optional, but if present must be an array
  if ('steps' in s && s.steps !== undefined && !Array.isArray(s.steps)) {
    return false;
  }

  return true;
}
