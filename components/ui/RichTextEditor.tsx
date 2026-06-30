'use client';

import { useEffect, useRef } from 'react';
import { Italic, Link, List, Type, Underline } from '@deemlol/next-icons';
import { prepareRichTextForEditing, sanitizeRichText } from '@/lib/richText';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

type Command = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedHtmlRef = useRef<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEmittedHtmlRef.current) return;

    const editorHtml = prepareRichTextForEditing(value);
    if (editor.innerHTML !== editorHtml) {
      editor.innerHTML = editorHtml;
    }
  }, [value]);

  const emitChange = () => {
    const sanitizedHtml = sanitizeRichText(editorRef.current?.innerHTML ?? '');
    lastEmittedHtmlRef.current = sanitizedHtml;
    onChange(sanitizedHtml);
  };

  const runCommand = (command: Command, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const setLink = () => {
    editorRef.current?.focus();
    const url = window.prompt('URL du lien');
    if (!url) return;

    document.execCommand('createLink', false, url);
    emitChange();
  };

  const clearFormatting = () => {
    editorRef.current?.focus();
    document.execCommand('removeFormat');
    emitChange();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, sanitizeRichText(text));
    emitChange();
  };

  return (
    <div className="border border-gray-300 focus-within:ring-2 focus-within:ring-black">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1">
        <ToolbarButton label="Gras" onClick={() => runCommand('bold')}>
          <span className="font-poppins text-sm font-bold leading-none">B</span>
        </ToolbarButton>
        <ToolbarButton label="Italique" onClick={() => runCommand('italic')}>
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton label="Souligné" onClick={() => runCommand('underline')}>
          <Underline size={16} />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton label="Liste à puces" onClick={() => runCommand('insertUnorderedList')}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton label="Liste numérotée" onClick={() => runCommand('insertOrderedList')}>
          <span className="font-poppins text-xs font-semibold leading-none">1.</span>
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton label="Lien" onClick={setLink}>
          <Link size={16} />
        </ToolbarButton>
        <ToolbarButton label="Effacer la mise en forme" onClick={clearFormatting}>
          <Type size={16} />
        </ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-label="Description"
        aria-multiline="true"
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={handlePaste}
        className="rich-text-content min-h-32 w-full bg-white p-3 font-ibm text-sm text-gray-900 outline-none"
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center border border-transparent text-gray-700 hover:border-gray-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-black"
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden="true" />;
}
