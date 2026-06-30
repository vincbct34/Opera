'use client';

import { Phone, Mail } from '@deemlol/next-icons';

/**
 * Props for the ContactModal component.
 */
interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ContactPerson {
  name: string;
  role: string;
  phone: string;
  email: string;
}

const contacts: ContactPerson[] = [
  {
    name: 'Caroline Maby',
    role: 'Responsable',
    phone: '04 30 78 17 99',
    email: 'caroline.maby@oonm.fr',
  },
  {
    name: 'Emmanuelle Picard',
    role: 'Assistante',
    phone: '04 67 60 19 71',
    email: 'emmanuelle.picard@oonm.fr',
  },
  {
    name: 'Mathilde Champroux',
    role: 'Médiation culturelle',
    phone: '04 67 60 19 96',
    email: 'mathilde.champroux@oonm.fr',
  },
  {
    name: 'Aurelio Croci',
    role: 'Assistant',
    phone: '04 30 78 16 59',
    email: 'aurelio.croci@oonm.fr',
  },
];

/**
 * Modal component displaying contact information for the organization.
 * Lists key contacts with phone numbers and email addresses.
 */
export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl shadow-lg border border-gray-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-poppins font-semibold">Nos contacts</h2>
          <p className="text-sm text-gray-600 mt-1 font-ibm">
            Contactez directement nos équipes pour toute question
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((contact, index) => (
              <div
                key={index}
                className="border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-poppins font-semibold text-base text-gray-900 mb-1">
                  {contact.name}
                </h3>
                <p className="text-sm text-gray-600 font-ibm mb-3">{contact.role}</p>

                <div className="space-y-2">
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-black font-ibm group"
                  >
                    <Phone size={16} className="text-gray-500 group-hover:text-black" />
                    <span className="group-hover:underline">{contact.phone}</span>
                  </a>

                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-black font-ibm group"
                  >
                    <Mail size={16} className="text-gray-500 group-hover:text-black" />
                    <span className="group-hover:underline break-all">{contact.email}</span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Info billetterie */}
          <div className="mt-6 bg-blue-50 border border-blue-200 px-4 py-3 text-sm font-ibm text-blue-800">
            <p className="font-semibold mb-1">Horaires de disponibilité</p>
            <p className="text-xs">Du lundi au vendredi | 9h - 12h et 14h - 17h</p>
          </div>

          {/* Action */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-black text-white cursor-pointer font-poppins font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
