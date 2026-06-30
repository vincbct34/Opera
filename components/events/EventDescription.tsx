import { richTextToPlainText, sanitizeRichText } from '@/lib/richText';

interface EventDescriptionProps {
  description?: string | null;
  preview?: boolean;
  className?: string;
}

export default function EventDescription({
  description,
  preview = false,
  className = '',
}: EventDescriptionProps) {
  if (!description) return null;

  if (preview) {
    const plainText = richTextToPlainText(description);
    if (!plainText) return null;

    return <p className={className}>{plainText}</p>;
  }

  const html = sanitizeRichText(description);
  if (!html) return null;

  return (
    <div className={`rich-text-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
