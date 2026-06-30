'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { HelpContent } from '@/lib/help/types';

interface HelpWidgetProps {
  content: HelpContent;
  isAdminPage?: boolean; // Indicate if this is an admin page
}

interface AdminNote {
  id: string;
  page_id: string;
  content: string;
  updated_at: string;
  created_at: string;
  author: {
    id: string;
    first_name: string | null;
    last_name: string;
    email: string;
  };
}

/**
 * HelpWidget - A floating help button that opens a modal with contextual help content
 *
 * Usage:
 * import { HelpWidget } from '@/components/ui/HelpWidget';
 * import { HELP_CONTENTS } from '@/lib/help/helpContents';
 *
 * <HelpWidget content={HELP_CONTENTS.MY_PAGE} />
 * <HelpWidget content={HELP_CONTENTS.MY_PAGE} isAdminPage={true} /> // For admin pages with notes
 */
export const HelpWidget: React.FC<HelpWidgetProps> = ({ content, isAdminPage = false }) => {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Admin notes state
  const [adminNote, setAdminNote] = useState<AdminNote | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteLoaded, setNoteLoaded] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const showAdminNotes = isAdminPage && isAdmin;

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsEditingNote(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Fetch admin notes when modal opens (for admin pages)
  const fetchAdminNote = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`/api/admin/notes/${content.pageId}`);
      const data = await response.json();

      if (data.success && data.note) {
        setAdminNote(data.note);
        setNoteContent(data.note.content);
      } else {
        setAdminNote(null);
        setNoteContent('');
      }
      setNoteLoaded(true);
    } catch (error) {
      console.error('Error fetching admin note:', error);
      setNoteError('Erreur lors du chargement de la note');
      setNoteLoaded(true);
    }
  }, [content.pageId]);

  useEffect(() => {
    if (isOpen && showAdminNotes && !noteLoaded) {
      fetchAdminNote();
    }
  }, [isOpen, showAdminNotes, noteLoaded, fetchAdminNote]);

  const saveAdminNote = async () => {
    if (!showAdminNotes) return;

    setIsSavingNote(true);
    setNoteError(null);

    try {
      const response = await fetchWithAuth(`/api/admin/notes/${content.pageId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: noteContent }),
      });

      const data = await response.json();

      if (data.success) {
        setAdminNote(data.note);
        setIsEditingNote(false);
      } else {
        setNoteError(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving admin note:', error);
      setNoteError('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingNote(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleSection = (index: number) => {
    setActiveSection(activeSection === index ? null : index);
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors duration-200 font-poppins font-semibold"
        aria-label="Aide"
        title="Aide sur cette page"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            className="bg-white w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-poppins font-semibold text-gray-900">
                  {content.title}
                </h2>
                {content.pageName && (
                  <p className="text-xs text-gray-500 font-ibm mt-0.5">{content.pageName}</p>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Fermer"
              >
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="px-6 py-5 pb-12 overflow-y-auto max-h-[calc(84vh-140px)]">
              {/* Description */}
              {content.description && (
                <p className="text-sm text-gray-700 font-ibm mb-6 leading-relaxed">
                  {content.description}
                </p>
              )}

              {/* Sections */}
              {content.sections && content.sections.length > 0 && (
                <div className="space-y-4 mb-6">
                  {content.sections.map((section, index) => {
                    const isSectionOpen = activeSection === index;
                    const hasSteps = section.steps && section.steps.length > 0;

                    return (
                      <div key={index} className="border border-gray-200 rounded overflow-hidden">
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(index)}
                          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          <h3 className="text-sm font-semibold font-poppins text-gray-900">
                            {section.title}
                          </h3>
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform ${
                              isSectionOpen ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {/* Section Content */}
                        {isSectionOpen && (
                          <div className="px-4 py-3 bg-white border-t border-gray-200">
                            <p className="text-sm text-gray-700 font-ibm leading-relaxed mb-3">
                              {section.content}
                            </p>
                            {hasSteps && (
                              <ol className="space-y-2">
                                {section.steps!.map((step, stepIndex) => (
                                  <li
                                    key={stepIndex}
                                    className="text-sm text-gray-700 font-ibm flex gap-3"
                                  >
                                    <span className="shrink-0 w-5 h-5 flex items-center justify-center bg-black text-white text-xs rounded font-poppins font-semibold">
                                      {stepIndex + 1}
                                    </span>
                                    <span className="pt-0.5">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tips */}
              {content.tips && content.tips.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded px-4 py-3 mb-6">
                  <div className="flex items-start gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-blue-600 mt-0.5 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <h4 className="text-sm font-semibold font-poppins text-blue-900">Conseils</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {content.tips.map((tip, index) => (
                      <li key={index} className="text-xs text-blue-800 font-ibm flex gap-2">
                        <span className="text-blue-600">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* FAQ */}
              {content.faq && content.faq.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold font-poppins text-gray-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Questions fréquentes
                  </h4>
                  <div className="space-y-2">
                    {content.faq.map((faq, index) => {
                      const isFaqOpen = activeFaq === index;
                      return (
                        <div key={index} className="border border-gray-200 rounded overflow-hidden">
                          <button
                            onClick={() => toggleFaq(index)}
                            className="w-full px-4 py-2.5 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left"
                          >
                            <span className="text-sm font-medium font-poppins text-gray-800">
                              {faq.question}
                            </span>
                            <svg
                              className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ml-2 ${
                                isFaqOpen ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                          {isFaqOpen && (
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                              <p className="text-sm text-gray-700 font-ibm leading-relaxed">
                                {faq.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Related Links */}
              {content.relatedLinks && content.relatedLinks.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold font-poppins text-gray-900 mb-3">
                    Pages connexes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {content.relatedLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className="px-3 py-2 border border-gray-300 hover:border-black hover:bg-black hover:text-white transition-colors rounded text-sm group"
                      >
                        <div className="font-medium font-poppins">{link.label}</div>
                        {link.description && (
                          <div className="text-xs text-gray-500 group-hover:text-gray-300 font-ibm mt-0.5">
                            {link.description}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Notes Section - Only for admin pages and admin users */}
              {showAdminNotes && (
                <div className="border-t border-gray-200 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold font-poppins text-gray-900 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-gray-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Notes de l&apos;équipe
                    </h4>
                    {!isEditingNote && isAdmin && (
                      <button
                        onClick={() => setIsEditingNote(true)}
                        className="text-xs text-gray-600 hover:text-black font-ibm underline decoration-gray-400 hover:decoration-black underline-offset-2 transition-all"
                      >
                        Modifier
                      </button>
                    )}
                  </div>

                  {noteError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded mb-3 font-ibm">
                      {noteError}
                    </div>
                  )}

                  {isEditingNote && isAdmin ? (
                    <div className="space-y-3">
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Ajoutez vos notes ici pour les autres membres de l'équipe..."
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-ibm focus:outline-none focus:ring-1 focus:ring-black focus:border-black resize-y"
                        rows={4}
                        disabled={isSavingNote}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveAdminNote}
                          disabled={isSavingNote}
                          className="px-3 py-1.5 bg-black text-white text-sm font-poppins rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSavingNote ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingNote(false);
                            setNoteContent(adminNote?.content || '');
                            setNoteError(null);
                          }}
                          disabled={isSavingNote}
                          className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-poppins rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-200 bg-white rounded p-4">
                      {noteContent ? (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700 font-ibm whitespace-pre-wrap wrap-break-word">
                            {noteContent}
                          </p>
                          {adminNote && (
                            <div className="flex items-center gap-2 text-xs text-gray-400 font-ibm pt-2 border-t border-gray-100">
                              <span>
                                Mis à jour par{' '}
                                <span className="font-medium text-gray-600">
                                  {adminNote.author.first_name} {adminNote.author.last_name}
                                </span>
                              </span>
                              <span>•</span>
                              <span>{formatDate(adminNote.updated_at)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic font-ibm">
                          Aucune note enregistrée. Cliquez sur <i>Modifier</i> pour ajouter une
                          note.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-poppins font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpWidget;
