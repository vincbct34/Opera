/**
 * Tests for lib/config/labelMappings.ts and lib/config/labelMappingsServer.ts
 * Centralized label mappings for French translations of database enums
 */

import {
  Accessibility,
  EventStatus,
  EventType,
  PublicCategory,
  RegistrationStatus,
} from '@/app/generated/prisma/enums';

import {
  EVENT_TYPE_LABELS,
  PUBLIC_CATEGORY_LABELS,
  EVENT_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  ACCESSIBILITY_LABELS,
  getEventTypeLabel,
  getEventTypeLabels,
  getPublicCategoryLabel,
  getPublicCategoryLabels,
  getEventStatusLabel,
  getRegistrationStatusLabel,
  getAccessibilityLabel,
  getAccessibilityLabels,
} from '../config/labelMappings';

// Import deprecated functions directly from labelDefaults for testing
import { getPublicTypeLabel, getPublicTypeLabels } from '../config/labelDefaults';

import {
  getEventTypeLabelAsync,
  getEventTypeLabelsMapAsync,
  getPublicCategoryLabelAsync,
  getPublicCategoryLabelsMapAsync,
  getPublicTypeLabelAsync,
  getPublicTypeLabelsMapAsync,
  getEventStatusLabelAsync,
  getEventStatusLabelsMapAsync,
  getRegistrationStatusLabelAsync,
  getRegistrationStatusLabelsMapAsync,
  getAccessibilityLabelAsync,
  getAccessibilityLabelsMapAsync,
  getAllLabelsAsync,
} from '../config/labelMappingsServer';

import { describe, expect, it, beforeEach, jest } from '@jest/globals';

// Mock the configService module
jest.mock('@/lib/config/configService', () => ({
  getConfig: jest.fn(),
}));
/* eslint-disable */
const { getConfig } = require('@/lib/config/configService');

describe('labelMappings', () => {
  // ==========================================================================
  // Label Objects Coverage
  // ==========================================================================

  describe('EVENT_TYPE_LABELS', () => {
    it('should have a label for all EventType values', () => {
      const eventTypes = Object.values(EventType);
      expect(Object.keys(EVENT_TYPE_LABELS).length).toBe(eventTypes.length);

      eventTypes.forEach((type) => {
        expect(EVENT_TYPE_LABELS[type]).toBeDefined();
        expect(typeof EVENT_TYPE_LABELS[type]).toBe('string');
      });
    });

    it('should have correct French labels for some event types', () => {
      expect(EVENT_TYPE_LABELS[EventType.OPERA]).toBe('Opéra');
      expect(EVENT_TYPE_LABELS[EventType.CONCERT_LYRIQUE]).toBe('Concert lyrique');
      expect(EVENT_TYPE_LABELS[EventType.SYMPHONIQUE]).toBe('Symphonique');
      expect(EVENT_TYPE_LABELS[EventType.CHAMBRE_BAROQUE]).toBe('Chambre / Baroque');
      expect(EVENT_TYPE_LABELS[EventType.OPERA_JUNIOR]).toBe('Opéra Junior');
      expect(EVENT_TYPE_LABELS[EventType.CINE_CONCERT]).toBe('Ciné-concert');
      expect(EVENT_TYPE_LABELS[EventType.THEATRE_MUSICAL]).toBe('Théâtre musical');
      expect(EVENT_TYPE_LABELS[EventType.ELECTRO_ACOUSTIQUE]).toBe('Électro-acoustique');
      expect(EVENT_TYPE_LABELS[EventType.MUSIQUES_DAILLEURS]).toBe("Musiques d'ailleurs");
    });
  });

  describe('PUBLIC_CATEGORY_LABELS', () => {
    it('should have a label for all PublicCategory values', () => {
      const publicCategories = Object.values(PublicCategory);
      expect(Object.keys(PUBLIC_CATEGORY_LABELS).length).toBe(publicCategories.length);

      publicCategories.forEach((type) => {
        expect(PUBLIC_CATEGORY_LABELS[type]).toBeDefined();
        expect(typeof PUBLIC_CATEGORY_LABELS[type]).toBe('string');
      });
    });

    it('should have correct French labels', () => {
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.CRECHE]).toBe('Crèche');
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.MATERNELLE]).toBe('Maternelle');
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.ELEMENTAIRE]).toBe('Élémentaire');
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.COLLEGE]).toBe('Collège');
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.LYCEE]).toBe('Lycée');
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.SUPERIEUR]).toBe('Enseignement supérieur');
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.ASSOCIATION]).toBe(
        'Association / Publics éloignés',
      );
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.CONSERVATOIRE]).toBe(
        'Conservatoire et école de musique',
      );
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.PERISCOLAIRE]).toBe(
        'Centre de loisirs / Périscolaire',
      );
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.PUBLICS_EMPECHES]).toBe(
        'Publics empêchés / Santé / Handicap',
      );
      expect(PUBLIC_CATEGORY_LABELS[PublicCategory.AUTRE]).toBe('Autre');
    });
  });

  describe('EVENT_STATUS_LABELS', () => {
    it('should have a label for all EventStatus values', () => {
      const statuses = Object.values(EventStatus);
      expect(Object.keys(EVENT_STATUS_LABELS).length).toBe(statuses.length);

      statuses.forEach((status) => {
        expect(EVENT_STATUS_LABELS[status]).toBeDefined();
        expect(typeof EVENT_STATUS_LABELS[status]).toBe('string');
      });
    });

    it('should have correct French labels', () => {
      expect(EVENT_STATUS_LABELS[EventStatus.OPEN]).toBe('Ouvert');
      expect(EVENT_STATUS_LABELS[EventStatus.CLOSED]).toBe('Fermé');
    });
  });

  describe('REGISTRATION_STATUS_LABELS', () => {
    it('should have a label for all RegistrationStatus values', () => {
      const statuses = Object.values(RegistrationStatus);
      expect(Object.keys(REGISTRATION_STATUS_LABELS).length).toBe(statuses.length);

      statuses.forEach((status) => {
        expect(REGISTRATION_STATUS_LABELS[status]).toBeDefined();
        expect(typeof REGISTRATION_STATUS_LABELS[status]).toBe('string');
      });
    });

    it('should have correct French labels', () => {
      expect(REGISTRATION_STATUS_LABELS[RegistrationStatus.PENDING]).toBe('En attente');
      expect(REGISTRATION_STATUS_LABELS[RegistrationStatus.CONFIRMED]).toBe('Confirmée');
      expect(REGISTRATION_STATUS_LABELS[RegistrationStatus.CANCELLED]).toBe('Annulée');
      expect(REGISTRATION_STATUS_LABELS[RegistrationStatus.REJECTED]).toBe('Refusée');
      expect(REGISTRATION_STATUS_LABELS[RegistrationStatus.ATTENDED]).toBe('Présent');
      expect(REGISTRATION_STATUS_LABELS[RegistrationStatus.NO_SHOW]).toBe('Absent');
    });
  });

  describe('ACCESSIBILITY_LABELS', () => {
    it('should have a label for all Accessibility values', () => {
      const types = Object.values(Accessibility);
      expect(Object.keys(ACCESSIBILITY_LABELS).length).toBe(types.length);

      types.forEach((type) => {
        expect(ACCESSIBILITY_LABELS[type]).toBeDefined();
        expect(typeof ACCESSIBILITY_LABELS[type]).toBe('string');
      });
    });

    it('should have correct French labels', () => {
      expect(ACCESSIBILITY_LABELS[Accessibility.VISUAL]).toBe('Handicap visuel');
      expect(ACCESSIBILITY_LABELS[Accessibility.AUDITORY]).toBe('Handicap auditif');
      expect(ACCESSIBILITY_LABELS[Accessibility.MOTOR]).toBe('Mobilité réduite');
      expect(ACCESSIBILITY_LABELS[Accessibility.PSYCHIC]).toBe('Handicap psychique');
    });
  });

  // ==========================================================================
  // Helper Functions Coverage
  // ==========================================================================

  describe('getEventTypeLabel', () => {
    it('should return the correct label for a valid EventType', () => {
      expect(getEventTypeLabel(EventType.OPERA)).toBe('Opéra');
      expect(getEventTypeLabel(EventType.JAZZ)).toBe('Jazz');
      expect(getEventTypeLabel(EventType.DANSE)).toBe('Danse');
    });

    it('should return the correct label for a string EventType', () => {
      expect(getEventTypeLabel('OPERA')).toBe('Opéra');
      expect(getEventTypeLabel('JAZZ')).toBe('Jazz');
    });

    it('should return the original value for an unknown type', () => {
      expect(getEventTypeLabel('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
      expect(getEventTypeLabel('random')).toBe('random');
    });
  });

  describe('getEventTypeLabels', () => {
    it('should return labels for multiple event types', () => {
      const types = [EventType.OPERA, EventType.JAZZ, EventType.DANSE];
      const labels = getEventTypeLabels(types);
      expect(labels).toEqual(['Opéra', 'Jazz', 'Danse']);
    });

    it('should handle string types', () => {
      const types = ['OPERA', 'JAZZ'];
      const labels = getEventTypeLabels(types);
      expect(labels).toEqual(['Opéra', 'Jazz']);
    });

    it('should handle empty array', () => {
      expect(getEventTypeLabels([])).toEqual([]);
    });

    it('should handle unknown types gracefully', () => {
      const types = [EventType.OPERA, 'UNKNOWN'];
      const labels = getEventTypeLabels(types);
      expect(labels).toEqual(['Opéra', 'UNKNOWN']);
    });
  });

  describe('getPublicCategoryLabel', () => {
    it('should return the correct label for a valid PublicCategory', () => {
      expect(getPublicCategoryLabel(PublicCategory.MATERNELLE)).toBe('Maternelle');
      expect(getPublicCategoryLabel(PublicCategory.COLLEGE)).toBe('Collège');
      expect(getPublicCategoryLabel(PublicCategory.LYCEE)).toBe('Lycée');
    });

    it('should return the correct label for a string PublicCategory', () => {
      expect(getPublicCategoryLabel('MATERNELLE')).toBe('Maternelle');
      expect(getPublicCategoryLabel('COLLEGE')).toBe('Collège');
    });

    it('should return the original value for an unknown type', () => {
      expect(getPublicCategoryLabel('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
    });
  });

  describe('getPublicCategoryLabels', () => {
    it('should return labels for multiple public categories', () => {
      const types = [PublicCategory.MATERNELLE, PublicCategory.ELEMENTAIRE, PublicCategory.COLLEGE];
      const labels = getPublicCategoryLabels(types);
      expect(labels).toEqual(['Maternelle', 'Élémentaire', 'Collège']);
    });

    it('should handle empty array', () => {
      expect(getPublicCategoryLabels([])).toEqual([]);
    });

    it('should handle unknown types gracefully', () => {
      const types = [PublicCategory.MATERNELLE, 'UNKNOWN'];
      const labels = getPublicCategoryLabels(types);
      expect(labels).toEqual(['Maternelle', 'UNKNOWN']);
    });
  });

  describe('getEventStatusLabel', () => {
    it('should return the correct label for a valid EventStatus', () => {
      expect(getEventStatusLabel(EventStatus.OPEN)).toBe('Ouvert');
      expect(getEventStatusLabel(EventStatus.CLOSED)).toBe('Fermé');
    });

    it('should return the correct label for a string EventStatus', () => {
      expect(getEventStatusLabel('OPEN')).toBe('Ouvert');
      expect(getEventStatusLabel('CLOSED')).toBe('Fermé');
    });

    it('should return the original value for an unknown status', () => {
      expect(getEventStatusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    });
  });

  describe('getRegistrationStatusLabel', () => {
    it('should return the correct label for a valid RegistrationStatus', () => {
      expect(getRegistrationStatusLabel(RegistrationStatus.PENDING)).toBe('En attente');
      expect(getRegistrationStatusLabel(RegistrationStatus.CONFIRMED)).toBe('Confirmée');
      expect(getRegistrationStatusLabel(RegistrationStatus.CANCELLED)).toBe('Annulée');
      expect(getRegistrationStatusLabel(RegistrationStatus.REJECTED)).toBe('Refusée');
      expect(getRegistrationStatusLabel(RegistrationStatus.ATTENDED)).toBe('Présent');
      expect(getRegistrationStatusLabel(RegistrationStatus.NO_SHOW)).toBe('Absent');
    });

    it('should return the correct label for a string RegistrationStatus', () => {
      expect(getRegistrationStatusLabel('PENDING')).toBe('En attente');
      expect(getRegistrationStatusLabel('CONFIRMED')).toBe('Confirmée');
    });

    it('should return the original value for an unknown status', () => {
      expect(getRegistrationStatusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    });
  });

  describe('getAccessibilityLabel', () => {
    it('should return the correct label for a valid Accessibility type', () => {
      expect(getAccessibilityLabel(Accessibility.VISUAL)).toBe('Handicap visuel');
      expect(getAccessibilityLabel(Accessibility.AUDITORY)).toBe('Handicap auditif');
      expect(getAccessibilityLabel(Accessibility.MOTOR)).toBe('Mobilité réduite');
      expect(getAccessibilityLabel(Accessibility.PSYCHIC)).toBe('Handicap psychique');
    });

    it('should return the correct label for a string Accessibility type', () => {
      expect(getAccessibilityLabel('VISUAL')).toBe('Handicap visuel');
      expect(getAccessibilityLabel('MOTOR')).toBe('Mobilité réduite');
    });

    it('should return the original value for an unknown type', () => {
      expect(getAccessibilityLabel('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
    });
  });

  describe('getAccessibilityLabels', () => {
    it('should return labels for multiple accessibility types', () => {
      const types = [Accessibility.VISUAL, Accessibility.MOTOR, Accessibility.AUDITORY];
      const labels = getAccessibilityLabels(types);
      expect(labels).toEqual(['Handicap visuel', 'Mobilité réduite', 'Handicap auditif']);
    });

    it('should handle empty array', () => {
      expect(getAccessibilityLabels([])).toEqual([]);
    });

    it('should handle unknown types gracefully', () => {
      const types = [Accessibility.VISUAL, 'UNKNOWN'];
      const labels = getAccessibilityLabels(types);
      expect(labels).toEqual(['Handicap visuel', 'UNKNOWN']);
    });
  });

  // ==========================================================================
  // Async Functions Coverage
  // ==========================================================================

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEventTypeLabelAsync', () => {
    it('should return the correct label for a valid EventType', async () => {
      getConfig.mockResolvedValue({ CUSTOM_OPERA: 'Custom Opéra' });
      const label = await getEventTypeLabelAsync('OPERA');
      expect(label).toBe('Opéra'); // Falls back to default when not in custom config
    });

    it('should return custom label when configured', async () => {
      getConfig.mockResolvedValue({ OPERA: 'Mon Opéra Custom' });
      const label = await getEventTypeLabelAsync('OPERA');
      expect(label).toBe('Mon Opéra Custom');
    });

    it('should return the original value for an unknown type', async () => {
      getConfig.mockResolvedValue({});
      const label = await getEventTypeLabelAsync('UNKNOWN_TYPE');
      expect(label).toBe('UNKNOWN_TYPE');
    });
  });

  describe('getEventTypeLabelsMapAsync', () => {
    it('should return default labels when config is empty', async () => {
      getConfig.mockResolvedValue({});
      const labels = await getEventTypeLabelsMapAsync();
      expect(labels).toEqual(EVENT_TYPE_LABELS);
      expect(getConfig).toHaveBeenCalledWith('event_type_labels');
    });

    it('should merge custom labels with defaults', async () => {
      getConfig.mockResolvedValue({ OPERA: 'Custom Opéra', JAZZ: 'Custom Jazz' });
      const labels = await getEventTypeLabelsMapAsync();
      expect(labels.OPERA).toBe('Custom Opéra');
      expect(labels.JAZZ).toBe('Custom Jazz');
      expect(labels.SYMPHONIQUE).toBe('Symphonique'); // Default preserved
    });

    it('should return default labels when configService throws', async () => {
      getConfig.mockRejectedValue(new Error('Database error'));
      const labels = await getEventTypeLabelsMapAsync();
      expect(labels).toEqual(EVENT_TYPE_LABELS);
    });
  });

  describe('getPublicCategoryLabelAsync', () => {
    it('should return the correct label for a valid PublicCategory', async () => {
      getConfig.mockResolvedValue({});
      const label = await getPublicCategoryLabelAsync('MATERNELLE');
      expect(label).toBe('Maternelle');
    });

    it('should return custom label when configured', async () => {
      getConfig.mockResolvedValue({ MATERNELLE: 'Petite section' });
      const label = await getPublicCategoryLabelAsync('MATERNELLE');
      expect(label).toBe('Petite section');
    });

    it('should return the original value for an unknown type', async () => {
      getConfig.mockResolvedValue({});
      const label = await getPublicCategoryLabelAsync('UNKNOWN_TYPE');
      expect(label).toBe('UNKNOWN_TYPE');
    });
  });

  describe('getPublicCategoryLabelsMapAsync', () => {
    it('should return default labels when config is empty', async () => {
      getConfig.mockResolvedValue({});
      const labels = await getPublicCategoryLabelsMapAsync();
      expect(labels).toEqual(PUBLIC_CATEGORY_LABELS);
      expect(getConfig).toHaveBeenCalledWith('public_category_labels');
    });

    it('should merge custom labels with defaults', async () => {
      getConfig.mockResolvedValue({ MATERNELLE: 'Custom Maternelle' });
      const labels = await getPublicCategoryLabelsMapAsync();
      expect(labels.MATERNELLE).toBe('Custom Maternelle');
      expect(labels.COLLEGE).toBe('Collège'); // Default preserved
    });

    it('should return default labels when configService throws', async () => {
      getConfig.mockRejectedValue(new Error('Database error'));
      const labels = await getPublicCategoryLabelsMapAsync();
      expect(labels).toEqual(PUBLIC_CATEGORY_LABELS);
    });
  });

  describe('getEventStatusLabelAsync', () => {
    it('should return the correct label for a valid EventStatus', async () => {
      getConfig.mockResolvedValue({});
      const label = await getEventStatusLabelAsync('OPEN');
      expect(label).toBe('Ouvert');
    });

    it('should return custom label when configured', async () => {
      getConfig.mockResolvedValue({ OPEN: 'Disponible' });
      const label = await getEventStatusLabelAsync('OPEN');
      expect(label).toBe('Disponible');
    });

    it('should return the original value for an unknown status', async () => {
      getConfig.mockResolvedValue({});
      const label = await getEventStatusLabelAsync('UNKNOWN_STATUS');
      expect(label).toBe('UNKNOWN_STATUS');
    });
  });

  describe('getEventStatusLabelsMapAsync', () => {
    it('should return default labels when config is empty', async () => {
      getConfig.mockResolvedValue({});
      const labels = await getEventStatusLabelsMapAsync();
      expect(labels).toEqual(EVENT_STATUS_LABELS);
      expect(getConfig).toHaveBeenCalledWith('event_status_labels');
    });

    it('should merge custom labels with defaults', async () => {
      getConfig.mockResolvedValue({ OPEN: 'Disponible' });
      const labels = await getEventStatusLabelsMapAsync();
      expect(labels.OPEN).toBe('Disponible');
      expect(labels.CLOSED).toBe('Fermé'); // Default preserved
    });

    it('should return default labels when configService throws', async () => {
      getConfig.mockRejectedValue(new Error('Database error'));
      const labels = await getEventStatusLabelsMapAsync();
      expect(labels).toEqual(EVENT_STATUS_LABELS);
    });
  });

  describe('getRegistrationStatusLabelAsync', () => {
    it('should return the correct label for a valid RegistrationStatus', async () => {
      getConfig.mockResolvedValue({});
      const label = await getRegistrationStatusLabelAsync('PENDING');
      expect(label).toBe('En attente');
    });

    it('should return custom label when configured', async () => {
      getConfig.mockResolvedValue({ PENDING: 'En cours' });
      const label = await getRegistrationStatusLabelAsync('PENDING');
      expect(label).toBe('En cours');
    });

    it('should return the original value for an unknown status', async () => {
      getConfig.mockResolvedValue({});
      const label = await getRegistrationStatusLabelAsync('UNKNOWN_STATUS');
      expect(label).toBe('UNKNOWN_STATUS');
    });
  });

  describe('getRegistrationStatusLabelsMapAsync', () => {
    it('should return default labels when config is empty', async () => {
      getConfig.mockResolvedValue({});
      const labels = await getRegistrationStatusLabelsMapAsync();
      expect(labels).toEqual(REGISTRATION_STATUS_LABELS);
      expect(getConfig).toHaveBeenCalledWith('registration_status_labels');
    });

    it('should merge custom labels with defaults', async () => {
      getConfig.mockResolvedValue({ PENDING: 'En cours de validation' });
      const labels = await getRegistrationStatusLabelsMapAsync();
      expect(labels.PENDING).toBe('En cours de validation');
      expect(labels.CONFIRMED).toBe('Confirmée'); // Default preserved
    });

    it('should return default labels when configService throws', async () => {
      getConfig.mockRejectedValue(new Error('Database error'));
      const labels = await getRegistrationStatusLabelsMapAsync();
      expect(labels).toEqual(REGISTRATION_STATUS_LABELS);
    });
  });

  describe('getAccessibilityLabelAsync', () => {
    it('should return the correct label for a valid Accessibility type', async () => {
      getConfig.mockResolvedValue({});
      const label = await getAccessibilityLabelAsync('VISUAL');
      expect(label).toBe('Handicap visuel');
    });

    it('should return custom label when configured', async () => {
      getConfig.mockResolvedValue({ VISUAL: 'Malvoyant' });
      const label = await getAccessibilityLabelAsync('VISUAL');
      expect(label).toBe('Malvoyant');
    });

    it('should return the original value for an unknown type', async () => {
      getConfig.mockResolvedValue({});
      const label = await getAccessibilityLabelAsync('UNKNOWN_TYPE');
      expect(label).toBe('UNKNOWN_TYPE');
    });
  });

  describe('getAccessibilityLabelsMapAsync', () => {
    it('should return default labels when config is empty', async () => {
      getConfig.mockResolvedValue({});
      const labels = await getAccessibilityLabelsMapAsync();
      expect(labels).toEqual(ACCESSIBILITY_LABELS);
      expect(getConfig).toHaveBeenCalledWith('accessibility_labels');
    });

    it('should merge custom labels with defaults', async () => {
      getConfig.mockResolvedValue({ VISUAL: 'Malvoyant', MOTOR: 'PMR' });
      const labels = await getAccessibilityLabelsMapAsync();
      expect(labels.VISUAL).toBe('Malvoyant');
      expect(labels.MOTOR).toBe('PMR');
      expect(labels.AUDITORY).toBe('Handicap auditif'); // Default preserved
    });

    it('should return default labels when configService throws', async () => {
      getConfig.mockRejectedValue(new Error('Database error'));
      const labels = await getAccessibilityLabelsMapAsync();
      expect(labels).toEqual(ACCESSIBILITY_LABELS);
    });
  });

  describe('getAllLabelsAsync', () => {
    it('should return all default labels when configs are empty', async () => {
      getConfig.mockResolvedValue({});
      const labels = await getAllLabelsAsync();
      expect(labels).toEqual({
        event_type_labels: EVENT_TYPE_LABELS,
        public_category_labels: PUBLIC_CATEGORY_LABELS,
        event_status_labels: EVENT_STATUS_LABELS,
        registration_status_labels: REGISTRATION_STATUS_LABELS,
        accessibility_labels: ACCESSIBILITY_LABELS,
      });
    });

    it('should fetch all configs in parallel', async () => {
      getConfig.mockResolvedValue({ custom: 'value' });
      await getAllLabelsAsync();
      // Should be called 5 times once for each label category
      expect(getConfig).toHaveBeenCalledTimes(5);
      expect(getConfig).toHaveBeenCalledWith('event_type_labels');
      expect(getConfig).toHaveBeenCalledWith('public_category_labels');
      expect(getConfig).toHaveBeenCalledWith('event_status_labels');
      expect(getConfig).toHaveBeenCalledWith('registration_status_labels');
      expect(getConfig).toHaveBeenCalledWith('accessibility_labels');
    });

    it('should merge custom labels with defaults for all categories', async () => {
      getConfig
        .mockResolvedValueOnce({ OPERA: 'Custom Opéra' })
        .mockResolvedValueOnce({ MATERNELLE: 'Custom Maternelle' })
        .mockResolvedValueOnce({ OPEN: 'Disponible' })
        .mockResolvedValueOnce({ PENDING: 'En cours' })
        .mockResolvedValueOnce({ VISUAL: 'Malvoyant' });

      const labels = await getAllLabelsAsync();
      expect(labels.event_type_labels.OPERA).toBe('Custom Opéra');
      expect(labels.event_type_labels.SYMPHONIQUE).toBe('Symphonique');
      expect(labels.public_category_labels.MATERNELLE).toBe('Custom Maternelle');
      expect(labels.public_category_labels.COLLEGE).toBe('Collège');
      expect(labels.event_status_labels.OPEN).toBe('Disponible');
      expect(labels.event_status_labels.CLOSED).toBe('Fermé');
      expect(labels.registration_status_labels.PENDING).toBe('En cours');
      expect(labels.registration_status_labels.CONFIRMED).toBe('Confirmée');
      expect(labels.accessibility_labels.VISUAL).toBe('Malvoyant');
      expect(labels.accessibility_labels.MOTOR).toBe('Mobilité réduite');
    });

    it('should return all default labels when configService throws', async () => {
      getConfig.mockRejectedValue(new Error('Database error'));
      const labels = await getAllLabelsAsync();
      expect(labels).toEqual({
        event_type_labels: EVENT_TYPE_LABELS,
        public_category_labels: PUBLIC_CATEGORY_LABELS,
        event_status_labels: EVENT_STATUS_LABELS,
        registration_status_labels: REGISTRATION_STATUS_LABELS,
        accessibility_labels: ACCESSIBILITY_LABELS,
      });
    });
  });

  // ==========================================================================
  // Deprecated Functions Coverage
  // ==========================================================================

  describe('getPublicTypeLabel (deprecated)', () => {
    it('should return the correct label for a valid PublicCategory (aliased)', () => {
      expect(getPublicTypeLabel('MATERNELLE')).toBe('Maternelle');
      expect(getPublicTypeLabel('COLLEGE')).toBe('Collège');
      expect(getPublicTypeLabel('LYCEE')).toBe('Lycée');
    });

    it('should return the original value for an unknown type', () => {
      expect(getPublicTypeLabel('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
    });
  });

  describe('getPublicTypeLabels (deprecated)', () => {
    it('should return labels for multiple public types (aliased to categories)', () => {
      const types = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE'];
      const labels = getPublicTypeLabels(types);
      expect(labels).toEqual(['Maternelle', 'Élémentaire', 'Collège']);
    });

    it('should handle empty array', () => {
      expect(getPublicTypeLabels([])).toEqual([]);
    });
  });

  describe('getPublicTypeLabelAsync (deprecated)', () => {
    it('should return the correct label (aliased to getPublicCategoryLabelAsync)', async () => {
      getConfig.mockResolvedValue({});
      const label = await getPublicTypeLabelAsync('MATERNELLE');
      expect(label).toBe('Maternelle');
    });
  });

  describe('getPublicTypeLabelsMapAsync (deprecated)', () => {
    it('should return labels map (aliased to getPublicCategoryLabelsMapAsync)', async () => {
      getConfig.mockResolvedValue({});
      const labels = await getPublicTypeLabelsMapAsync();
      expect(labels.MATERNELLE).toBe('Maternelle');
      expect(labels.COLLEGE).toBe('Collège');
    });
  });
});
