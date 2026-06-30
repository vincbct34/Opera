/**
 * Tests for Help Widget contents
 * Validates all help content exports and helper functions
 */

import {
  ADMIN_DASHBOARD,
  ADMIN_EVENTS,
  ADMIN_USERS,
  ADMIN_INSTITUTIONS,
  ADMIN_STATISTICS,
  ADMIN_SECURITY,
  ADMIN_SETTINGS,
  ADMIN_SCORING,
  ADMIN_IMPORT,
  ADMIN_BACKUP,
  HOME,
  EVENTS,
  EVENT_DETAIL,
  ACCOUNT,
  ACCOUNT_REGISTRATIONS,
  ACCOUNT_GROUPS,
  ACCOUNT_INSTITUTIONS,
  LOGIN,
  REGISTER,
  LEGAL_NOTICES,
  CONTACT,
  STYLE_GUIDE,
  HELP_CONTENTS,
  getHelpContent,
} from '../helpContents';
import type { HelpContent } from '../types';
import { describe, it, expect } from '@jest/globals';

describe('Help Contents', () => {
  describe('Admin pages exports', () => {
    it('should export ADMIN_DASHBOARD with correct structure', () => {
      expect(ADMIN_DASHBOARD).toBeDefined();
      expect(ADMIN_DASHBOARD.pageId).toBe('admin-dashboard');
      expect(ADMIN_DASHBOARD.pageName).toBe('Tableau de bord Admin');
      expect(ADMIN_DASHBOARD.title).toBe('Tableau de bord Administrateur');
      expect(ADMIN_DASHBOARD.description).toBeTruthy();
      expect(ADMIN_DASHBOARD.sections).toBeInstanceOf(Array);
      expect(ADMIN_DASHBOARD.sections.length).toBeGreaterThan(0);
      expect(ADMIN_DASHBOARD.faq).toBeInstanceOf(Array);
      expect(ADMIN_DASHBOARD.relatedLinks).toBeInstanceOf(Array);
      expect(ADMIN_DASHBOARD.tips).toBeInstanceOf(Array);
    });

    it('should export ADMIN_EVENTS with correct structure', () => {
      expect(ADMIN_EVENTS).toBeDefined();
      expect(ADMIN_EVENTS.pageId).toBe('admin-events');
      expect(ADMIN_EVENTS.pageName).toBe('Gestion des événements');
      expect(ADMIN_EVENTS.sections.length).toBeGreaterThan(0);
      expect(ADMIN_EVENTS.sections.some((s) => s.steps !== undefined)).toBe(true);
    });

    it('should export ADMIN_USERS with correct structure', () => {
      expect(ADMIN_USERS).toBeDefined();
      expect(ADMIN_USERS.pageId).toBe('admin-users');
      expect(ADMIN_USERS.pageName).toBe('Gestion des utilisateurs');
      expect(ADMIN_USERS.sections.length).toBeGreaterThan(0);
      expect(ADMIN_USERS.faq).toBeInstanceOf(Array);
      if (ADMIN_USERS.faq) {
        expect(ADMIN_USERS.faq.length).toBeGreaterThan(0);
      }
    });

    it('should export ADMIN_INSTITUTIONS with correct structure', () => {
      expect(ADMIN_INSTITUTIONS).toBeDefined();
      expect(ADMIN_INSTITUTIONS.pageId).toBe('admin-institutions');
      expect(ADMIN_INSTITUTIONS.pageName).toBe('Gestion des institutions');
      expect(ADMIN_INSTITUTIONS.sections.length).toBeGreaterThan(0);
    });

    it('should export ADMIN_STATISTICS with correct structure', () => {
      expect(ADMIN_STATISTICS).toBeDefined();
      expect(ADMIN_STATISTICS.pageId).toBe('admin-statistics');
      expect(ADMIN_STATISTICS.pageName).toBe('Statistiques');
      expect(ADMIN_STATISTICS.sections.length).toBeGreaterThan(0);
    });

    it('should export ADMIN_SECURITY with correct structure', () => {
      expect(ADMIN_SECURITY).toBeDefined();
      expect(ADMIN_SECURITY.pageId).toBe('admin-security');
      expect(ADMIN_SECURITY.pageName).toBe('Journal de sécurité');
      expect(ADMIN_SECURITY.sections.length).toBeGreaterThan(0);
    });

    it('should export ADMIN_SETTINGS with correct structure', () => {
      expect(ADMIN_SETTINGS).toBeDefined();
      expect(ADMIN_SETTINGS.pageId).toBe('admin-settings');
      expect(ADMIN_SETTINGS.pageName).toBe('Paramètres');
      expect(ADMIN_SETTINGS.sections.length).toBeGreaterThan(0);
    });

    it('should export ADMIN_SCORING with correct structure', () => {
      expect(ADMIN_SCORING).toBeDefined();
      expect(ADMIN_SCORING.pageId).toBe('admin-scoring');
      expect(ADMIN_SCORING.pageName).toBe('Configuration du scoring');
      expect(ADMIN_SCORING.sections.length).toBeGreaterThan(0);
    });

    it('should export ADMIN_IMPORT with correct structure', () => {
      expect(ADMIN_IMPORT).toBeDefined();
      expect(ADMIN_IMPORT.pageId).toBe('admin-import');
      expect(ADMIN_IMPORT.pageName).toBe("Import d'inscriptions");
      expect(ADMIN_IMPORT.sections.length).toBeGreaterThan(0);
    });

    it('should export ADMIN_BACKUP with correct structure', () => {
      expect(ADMIN_BACKUP).toBeDefined();
      expect(ADMIN_BACKUP.pageId).toBe('admin-backup');
      expect(ADMIN_BACKUP.pageName).toBe('Sauvegardes');
      expect(ADMIN_BACKUP.sections.length).toBeGreaterThan(0);
    });
  });

  describe('User pages exports', () => {
    it('should export HOME with correct structure', () => {
      expect(HOME).toBeDefined();
      expect(HOME.pageId).toBe('home');
      expect(HOME.pageName).toBe('Accueil');
      expect(HOME.title).toBeTruthy();
      expect(HOME.sections.length).toBeGreaterThan(0);
      expect(HOME.faq).toBeInstanceOf(Array);
      expect(HOME.relatedLinks).toBeInstanceOf(Array);
      expect(HOME.tips).toBeInstanceOf(Array);
    });

    it('should export EVENTS with correct structure', () => {
      expect(EVENTS).toBeDefined();
      expect(EVENTS.pageId).toBe('events');
      expect(EVENTS.pageName).toBe('Liste des événements');
      expect(EVENTS.sections.length).toBeGreaterThan(0);
    });

    it('should export EVENT_DETAIL with correct structure', () => {
      expect(EVENT_DETAIL).toBeDefined();
      expect(EVENT_DETAIL.pageId).toBe('event-detail');
      expect(EVENT_DETAIL.pageName).toBe("Détail d'un événement");
      expect(EVENT_DETAIL.sections.length).toBeGreaterThan(0);
    });

    it('should export ACCOUNT with correct structure', () => {
      expect(ACCOUNT).toBeDefined();
      expect(ACCOUNT.pageId).toBe('account');
      expect(ACCOUNT.pageName).toBe('Mon compte');
      expect(ACCOUNT.sections.length).toBeGreaterThan(0);
    });

    it('should export ACCOUNT_REGISTRATIONS with correct structure', () => {
      expect(ACCOUNT_REGISTRATIONS).toBeDefined();
      expect(ACCOUNT_REGISTRATIONS.pageId).toBe('account-registrations');
      expect(ACCOUNT_REGISTRATIONS.pageName).toBe('Mes inscriptions');
      expect(ACCOUNT_REGISTRATIONS.sections.length).toBeGreaterThan(0);
    });

    it('should export ACCOUNT_GROUPS with correct structure', () => {
      expect(ACCOUNT_GROUPS).toBeDefined();
      expect(ACCOUNT_GROUPS.pageId).toBe('account-groups');
      expect(ACCOUNT_GROUPS.pageName).toBe('Mes groupes');
      expect(ACCOUNT_GROUPS.sections.length).toBeGreaterThan(0);
    });

    it('should export ACCOUNT_INSTITUTIONS with correct structure', () => {
      expect(ACCOUNT_INSTITUTIONS).toBeDefined();
      expect(ACCOUNT_INSTITUTIONS.pageId).toBe('account-institutions');
      expect(ACCOUNT_INSTITUTIONS.pageName).toBe('Mes institutions');
      expect(ACCOUNT_INSTITUTIONS.sections.length).toBeGreaterThan(0);
    });
  });

  describe('Auth pages exports', () => {
    it('should export LOGIN with correct structure', () => {
      expect(LOGIN).toBeDefined();
      expect(LOGIN.pageId).toBe('login');
      expect(LOGIN.pageName).toBe('Connexion');
      expect(LOGIN.sections.length).toBeGreaterThan(0);
      expect(LOGIN.faq).toBeInstanceOf(Array);
      expect(LOGIN.relatedLinks).toBeInstanceOf(Array);
      expect(LOGIN.tips).toBeInstanceOf(Array);
    });

    it('should export REGISTER with correct structure', () => {
      expect(REGISTER).toBeDefined();
      expect(REGISTER.pageId).toBe('register');
      expect(REGISTER.pageName).toBe('Inscription');
      expect(REGISTER.sections.length).toBeGreaterThan(0);
    });
  });

  describe('Other pages exports', () => {
    it('should export LEGAL_NOTICES with correct structure', () => {
      expect(LEGAL_NOTICES).toBeDefined();
      expect(LEGAL_NOTICES.pageId).toBe('legal-notices');
      expect(LEGAL_NOTICES.pageName).toBe('Mentions légales');
      expect(LEGAL_NOTICES.sections.length).toBeGreaterThan(0);
    });

    it('should export CONTACT with correct structure', () => {
      expect(CONTACT).toBeDefined();
      expect(CONTACT.pageId).toBe('contact');
      expect(CONTACT.pageName).toBe('Contact');
      expect(CONTACT.sections.length).toBeGreaterThan(0);
    });

    it('should export STYLE_GUIDE with correct structure', () => {
      expect(STYLE_GUIDE).toBeDefined();
      expect(STYLE_GUIDE.pageId).toBe('style-guide');
      expect(STYLE_GUIDE.pageName).toBe('Guide de style');
      expect(STYLE_GUIDE.sections.length).toBeGreaterThan(0);
    });
  });

  describe('HELP_CONTENTS map', () => {
    it('should contain all admin page IDs', () => {
      expect(HELP_CONTENTS['admin-dashboard']).toBe(ADMIN_DASHBOARD);
      expect(HELP_CONTENTS['admin-events']).toBe(ADMIN_EVENTS);
      expect(HELP_CONTENTS['admin-users']).toBe(ADMIN_USERS);
      expect(HELP_CONTENTS['admin-institutions']).toBe(ADMIN_INSTITUTIONS);
      expect(HELP_CONTENTS['admin-statistics']).toBe(ADMIN_STATISTICS);
      expect(HELP_CONTENTS['admin-security']).toBe(ADMIN_SECURITY);
      expect(HELP_CONTENTS['admin-settings']).toBe(ADMIN_SETTINGS);
      expect(HELP_CONTENTS['admin-scoring']).toBe(ADMIN_SCORING);
      expect(HELP_CONTENTS['admin-import']).toBe(ADMIN_IMPORT);
      expect(HELP_CONTENTS['admin-backup']).toBe(ADMIN_BACKUP);
    });

    it('should contain all user page IDs', () => {
      expect(HELP_CONTENTS['home']).toBe(HOME);
      expect(HELP_CONTENTS['events']).toBe(EVENTS);
      expect(HELP_CONTENTS['event-detail']).toBe(EVENT_DETAIL);
      expect(HELP_CONTENTS['account']).toBe(ACCOUNT);
      expect(HELP_CONTENTS['account-registrations']).toBe(ACCOUNT_REGISTRATIONS);
      expect(HELP_CONTENTS['account-groups']).toBe(ACCOUNT_GROUPS);
      expect(HELP_CONTENTS['account-institutions']).toBe(ACCOUNT_INSTITUTIONS);
    });

    it('should contain all auth page IDs', () => {
      expect(HELP_CONTENTS['login']).toBe(LOGIN);
      expect(HELP_CONTENTS['register']).toBe(REGISTER);
    });

    it('should contain all other page IDs', () => {
      expect(HELP_CONTENTS['legal-notices']).toBe(LEGAL_NOTICES);
      expect(HELP_CONTENTS['contact']).toBe(CONTACT);
      expect(HELP_CONTENTS['style-guide']).toBe(STYLE_GUIDE);
    });

    it('should have the correct number of entries', () => {
      const expectedCount = 22; // 10 admin + 7 user + 2 auth + 3 other
      expect(Object.keys(HELP_CONTENTS).length).toBe(expectedCount);
    });

    it('should have valid HelpContent for all entries', () => {
      Object.entries(HELP_CONTENTS).forEach(([pageId, content]) => {
        expect(content).toBeDefined();
        expect(content.pageId).toBe(pageId);
        expect(content.pageName).toBeTruthy();
        expect(content.title).toBeTruthy();
        expect(content.description).toBeTruthy();
        expect(content.sections).toBeInstanceOf(Array);
        expect(content.sections.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getHelpContent helper function', () => {
    it('should return correct content for valid page IDs', () => {
      expect(getHelpContent('admin-dashboard')).toBe(ADMIN_DASHBOARD);
      expect(getHelpContent('home')).toBe(HOME);
      expect(getHelpContent('login')).toBe(LOGIN);
    });

    it('should return undefined for invalid page IDs', () => {
      expect(getHelpContent('invalid-page-id')).toBeUndefined();
      expect(getHelpContent('')).toBeUndefined();
      expect(getHelpContent('non-existent')).toBeUndefined();
    });

    it('should return HelpContent type for valid IDs', () => {
      const result = getHelpContent('events');
      expect(result).toBeDefined();
      if (result) {
        expect(result.pageId).toBe('events');
        expect(result.sections).toBeInstanceOf(Array);
      }
    });

    it('should handle all valid page IDs from HELP_CONTENTS', () => {
      Object.keys(HELP_CONTENTS).forEach((pageId) => {
        const result = getHelpContent(pageId);
        expect(result).toBeDefined();
        expect(result?.pageId).toBe(pageId);
      });
    });
  });

  describe('HelpContent structure validation', () => {
    const validateHelpContent = (content: HelpContent, pageId: string) => {
      expect(content.pageId).toBe(pageId);
      expect(content.pageName).toBeTruthy();
      expect(content.title).toBeTruthy();
      expect(content.description).toBeTruthy();

      // Validate sections
      expect(content.sections).toBeInstanceOf(Array);
      expect(content.sections.length).toBeGreaterThan(0);
      content.sections.forEach((section) => {
        expect(section.title).toBeTruthy();
        expect(section.content).toBeTruthy();
        if (section.steps) {
          expect(section.steps).toBeInstanceOf(Array);
        }
      });

      // Validate optional FAQ
      if (content.faq) {
        expect(content.faq).toBeInstanceOf(Array);
        content.faq.forEach((faq) => {
          expect(faq.question).toBeTruthy();
          expect(faq.answer).toBeTruthy();
        });
      }

      // Validate optional relatedLinks
      if (content.relatedLinks) {
        expect(content.relatedLinks).toBeInstanceOf(Array);
        content.relatedLinks.forEach((link) => {
          expect(link.label).toBeTruthy();
          expect(link.href).toBeTruthy();
        });
      }

      // Validate optional tips
      if (content.tips) {
        expect(content.tips).toBeInstanceOf(Array);
        content.tips.forEach((tip) => {
          expect(tip).toBeTruthy();
        });
      }
    };

    it('should validate all admin help contents', () => {
      validateHelpContent(ADMIN_DASHBOARD, 'admin-dashboard');
      validateHelpContent(ADMIN_EVENTS, 'admin-events');
      validateHelpContent(ADMIN_USERS, 'admin-users');
      validateHelpContent(ADMIN_INSTITUTIONS, 'admin-institutions');
      validateHelpContent(ADMIN_STATISTICS, 'admin-statistics');
      validateHelpContent(ADMIN_SECURITY, 'admin-security');
      validateHelpContent(ADMIN_SETTINGS, 'admin-settings');
      validateHelpContent(ADMIN_SCORING, 'admin-scoring');
      validateHelpContent(ADMIN_IMPORT, 'admin-import');
      validateHelpContent(ADMIN_BACKUP, 'admin-backup');
    });

    it('should validate all user help contents', () => {
      validateHelpContent(HOME, 'home');
      validateHelpContent(EVENTS, 'events');
      validateHelpContent(EVENT_DETAIL, 'event-detail');
      validateHelpContent(ACCOUNT, 'account');
      validateHelpContent(ACCOUNT_REGISTRATIONS, 'account-registrations');
      validateHelpContent(ACCOUNT_GROUPS, 'account-groups');
      validateHelpContent(ACCOUNT_INSTITUTIONS, 'account-institutions');
    });

    it('should validate all auth help contents', () => {
      validateHelpContent(LOGIN, 'login');
      validateHelpContent(REGISTER, 'register');
    });

    it('should validate all other help contents', () => {
      validateHelpContent(LEGAL_NOTICES, 'legal-notices');
      validateHelpContent(CONTACT, 'contact');
      validateHelpContent(STYLE_GUIDE, 'style-guide');
    });
  });
});
