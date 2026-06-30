/**
 * Centralized help contents for all pages in the application
 * Import specific page content and pass it to the HelpWidget component
 */

import type { HelpContent, HelpContentsMap } from './types';

// ============================================================================
// ADMIN PAGES
// ============================================================================

export const ADMIN_DASHBOARD: HelpContent = {
  pageId: 'admin-dashboard',
  pageName: 'Tableau de bord Admin',
  title: 'Tableau de bord Administrateur',
  description:
    "Vue d'ensemble de l'ensemble de la plateforme avec les statistiques clés et les actions rapides.",
  sections: [
    {
      title: 'Statistiques globales',
      content:
        "Consultez en un coup d'œil le nombre d'utilisateurs, d'institutions, d'événements et d'inscriptions. Les chiffres sont mis à jour en temps réel.",
    },
    {
      title: 'Actions rapides',
      content:
        'Accédez rapidement aux fonctionnalités les plus utilisées : créer un événement, ajouter un utilisateur, exporter les données.',
    },
    {
      title: 'Événements à venir',
      content:
        'Liste des prochains événements avec leur statut et le nombre de places disponibles.',
      steps: [
        'Cliquez sur "Voir tout" pour accéder à la liste complète',
        'Les événements ouverts en orange indiquent que les inscriptions sont en cours',
        'Les événements fermés en gris ne sont pas encore ouverts aux inscriptions',
      ],
    },
  ],
  faq: [
    {
      question: 'À quelle fréquence les statistiques sont-elles mises à jour ?',
      answer: 'Les statistiques sont calculées en temps réel à chaque chargement de la page.',
    },
    {
      question: 'Puis-je personnaliser ce tableau de bord ?',
      answer:
        'Le tableau de bord affiche les informations les plus pertinentes. Pour des analyses plus détaillées, rendez-vous sur la page Statistiques.',
    },
  ],
  relatedLinks: [
    {
      label: 'Voir les événements',
      href: '/admin/events',
      description: 'Gérer tous les événements',
    },
    {
      label: 'Statistiques détaillées',
      href: '/admin/statistics',
      description: 'Analyses avancées',
    },
    {
      label: 'Gérer les utilisateurs',
      href: '/admin/users',
      description: 'Administration des comptes',
    },
  ],
  tips: [
    'Utilisez les raccourcis clavier pour naviguer plus vite',
    "Les alertes de notification apparaissent en haut à droite de l'écran",
  ],
};

export const ADMIN_EVENTS: HelpContent = {
  pageId: 'admin-events',
  pageName: 'Gestion des événements',
  title: 'Gestion des Événements',
  description:
    'Créez, modifiez et supprimez des événements. Consultez les inscriptions et gérez les présences.',
  sections: [
    {
      title: 'Liste des événements',
      content:
        "Tous les événements de la saison sont affichés ici avec leur statut, leur type et le nombre d'inscriptions.",
      steps: [
        'Utilisez la barre de recherche pour filtrer par titre',
        'Les filtres permettent de trier par statut, type ou date',
        'Cliquez sur un événement pour voir ses détails',
      ],
    },
    {
      title: 'Créer un événement',
      content: 'Cliquez sur le bouton "Nouvel événement" pour créer un événement manuellement.',
      steps: [
        'Remplissez les informations générales (titre, description, type)',
        'Ajoutez les dates et heures de représentation',
        'Définissez les catégories de public accueillies',
        "Précisez la capacité d'accueil et les informations d'accessibilité",
      ],
    },
    {
      title: 'Inscriptions et présences',
      content:
        "Pour chaque événement, vous pouvez consulter la liste des inscriptions et marquer les présences après l'événement.",
    },
  ],
  faq: [
    {
      question: 'Quelle est la différence entre "Ouvert" et "Fermé" ?',
      answer:
        'Un événement "Ouvert" accepte les inscriptions. Un événement "Fermé" n\'est pas encore disponible aux inscriptions (progression selon les vacances scolaires).',
    },
    {
      question: 'Puis-je modifier un événement après sa création ?',
      answer:
        "Oui, mais certains champs sont protégés si l'événement a été importé automatiquement pour éviter les écrasements lors de la synchronisation.",
    },
    {
      question: 'Comment fonctionnent les inscriptions ?',
      answer:
        'Les inscriptions sont automatiquement scorées selon les critères définis dans la configuration du scoring. Vous pouvez ensuite les trier et les valider.',
    },
  ],
  relatedLinks: [
    {
      label: 'Configuration du scoring',
      href: '/admin/scoring',
      description: 'Définir les critères de sélection',
    },
    {
      label: 'Importer des inscriptions existantes',
      href: '/admin/import',
      description: 'Import depuis Excel',
    },
    { label: 'Statistiques', href: '/admin/statistics', description: 'Analyses des inscriptions' },
  ],
  tips: [
    "Les événements sont synchronisés automatiquement avec le site de l'Opéra",
    "Vous pouvez protéger certains champs pour éviter qu'ils soient écrasés par la synchronisation",
    "Utilisez l'export Excel pour garder une trace des inscriptions",
  ],
};

export const ADMIN_USERS: HelpContent = {
  pageId: 'admin-users',
  pageName: 'Gestion des utilisateurs',
  title: 'Gestion des Utilisateurs',
  description: "Gérez les comptes utilisateurs, leurs institutions et leurs droits d'accès.",
  sections: [
    {
      title: 'Liste des utilisateurs',
      content:
        'Tous les utilisateurs de la plateforme sont listés ici avec leur rôle et leurs institutions associées.',
    },
    {
      title: 'Rôles et permissions',
      content: "Trois niveaux de droits existent dans l'application.",
      steps: [
        "USER : Utilisateur standard (peut s'inscrire aux événements)",
        'ADMIN : Administrateur (accès au panel admin, validation des inscriptions)',
        'SUPERADMIN : Super administrateur (tous les droits, gestion des comptes admins)',
      ],
    },
    {
      title: 'Créer un utilisateur',
      content: 'Cliquez sur "Ajouter un utilisateur" pour créer un nouveau compte.',
      steps: [
        'Remplissez les informations personnelles',
        'Sélectionnez le rôle approprié',
        'Attribuez les institutions pertinentes',
        "L'utilisateur recevra un email de vérification",
      ],
    },
  ],
  faq: [
    {
      question: 'Un utilisateur peut-il appartenir à plusieurs institutions ?',
      answer:
        'Oui, un utilisateur peut être associé à plusieurs institutions (par exemple, un enseignant qui travaille dans plusieurs écoles).',
    },
    {
      question: "Comment réinitialiser le mot de passe d'un utilisateur ?",
      answer:
        'Cliquez sur l\'utilisateur, puis sur "Réinitialiser le mot de passe". Un email sera envoyé à l\'utilisateur.',
    },
    {
      question: 'Puis-je verrouiller un compte utilisateur ?',
      answer:
        'Oui, vous pouvez verrouiller un compte après trop de tentatives de connexion infructueuses. Le compte sera automatiquement déverrouillé après 1 heure.',
    },
  ],
  relatedLinks: [
    {
      label: 'Gérer les institutions',
      href: '/admin/institutions',
      description: 'Administration des établissements',
    },
    {
      label: 'Journal de sécurité',
      href: '/admin/security',
      description: 'Surveiller les connexions',
    },
  ],
  tips: [
    'Vérifiez régulièrement les comptes inactifs',
    'Les nouveaux utilisateurs doivent vérifier leur email avant de se connecter',
  ],
};

export const ADMIN_INSTITUTIONS: HelpContent = {
  pageId: 'admin-institutions',
  pageName: 'Gestion des institutions',
  title: 'Gestion des Institutions',
  description:
    'Consultez, modifiez et créez des institutions (écoles, associations, conservatoires...).',
  sections: [
    {
      title: 'Recherche et filtres',
      content:
        'La recherche utilise la correspondance approximative pour trouver des institutions même avec des fautes de frappe.',
    },
    {
      title: "Détails d'une institution",
      content:
        "Chaque institution contient les informations de contact, l'adresse, les catégories de public et l'historique des demandes.",
      steps: [
        "L'historique montre le nombre de demandes, le taux de présence et les demandes refusées",
        'Les badges REP+ indiquent les établissements en éducation prioritaire',
        "Le dernier contact permet de suivre l'activité",
      ],
    },
    {
      title: 'Créer une institution',
      content:
        "Vous pouvez créer manuellement une institution si elle n'existe pas encore dans la base.",
    },
  ],
  faq: [
    {
      question: 'Comment fonctionne la recherche approximative ?',
      answer:
        "Elle utilise l'algorithme de Levenshtein pour trouver des institutions même si le nom contient des fautes de frappe ou des variations.",
    },
    {
      question: 'Puis-je fusionner deux institutions ?',
      answer:
        "Non, mais vous pouvez modifier l'institution pour corriger le nom et réassocier les utilisateurs.",
    },
  ],
  relatedLinks: [
    {
      label: 'Gérer les utilisateurs',
      href: '/admin/users',
      description: 'Administration des comptes',
    },
    { label: 'Statistiques', href: '/admin/statistics', description: 'Analyses par institution' },
  ],
  tips: [
    "Vérifiez que l'institution n'existe pas déjà avant d'en créer une nouvelle",
    'Les catégories de public sont importantes pour le scoring des inscriptions',
  ],
};

export const ADMIN_STATISTICS: HelpContent = {
  pageId: 'admin-statistics',
  pageName: 'Statistiques',
  title: 'Statistiques et Analyses',
  description: 'Visualisez et analysez les données de la plateforme avec des graphiques détaillés.',
  sections: [
    {
      title: "Vue d'ensemble",
      content:
        'Les statistiques principales incluent les utilisateurs, institutions, événements et inscriptions avec des tendances temporelles.',
    },
    {
      title: 'Filtrage par date',
      content:
        'Sélectionnez une période personnalisée pour analyser les données sur une durée spécifique.',
    },
    {
      title: 'Export des données',
      content:
        'Exportez les statistiques en différents formats pour les utiliser dans des rapports ou présentations.',
    },
  ],
  faq: [
    {
      question: 'Les données sont-elles en temps réel ?',
      answer: 'Oui, les statistiques sont calculées à chaque chargement de page.',
    },
    {
      question: 'Puis-je comparer deux périodes ?',
      answer:
        'Utilisez les filtres de date pour comparer les données entre deux périodes différentes.',
    },
  ],
  relatedLinks: [
    { label: 'Événements', href: '/admin/events', description: 'Gérer les événements' },
    {
      label: 'Inscriptions',
      href: '/admin/registrations',
      description: 'Voir toutes les inscriptions',
    },
  ],
  tips: [
    "Utilisez l'export pour garder des archives historiques",
    'Les graphiques sont interactifs, survolez-les pour voir les détails',
  ],
};

export const ADMIN_SECURITY: HelpContent = {
  pageId: 'admin-security',
  pageName: 'Journal de sécurité',
  title: 'Journal de Sécurité',
  description: 'Surveillance des événements de sécurité et détection de comportements suspects.',
  sections: [
    {
      title: 'Événements de sécurité',
      content:
        'Tous les événements de sécurité sont consignés ici : connexions, échecs, verrouillages, etc.',
      steps: [
        'INFO : Événements normaux (connexion réussie)',
        'WARNING : Événements suspects (trop de tentatives)',
        'CRITICAL : Événements graves (compte verrouillé)',
      ],
    },
    {
      title: 'Détection de patterns',
      content:
        "Le système détecte automatiquement les comportements suspects comme les tentatives d'intrusion ou les attaques par force brute.",
    },
    {
      title: 'Filtrage',
      content: 'Filtrez les événements par type, utilisateur, date ou niveau de gravité.',
    },
  ],
  faq: [
    {
      question: "Que faire en cas de détection d'activité suspecte ?",
      answer:
        "Vérifiez les détails de l'événement, contactez l'utilisateur concerné si nécessaire, et verrouillez le compte en cas de compromission avérée.",
    },
    {
      question: 'Combien de temps les logs sont-ils conservés ?',
      answer: 'Les logs sont conservés indéfiniment pour assurer la traçabilité.',
    },
  ],
  relatedLinks: [
    {
      label: 'Gérer les utilisateurs',
      href: '/admin/users',
      description: 'Administrer les comptes',
    },
    { label: 'Paramètres', href: '/admin/settings', description: 'Configuration de la sécurité' },
  ],
  tips: [
    'Surveillez régulièrement les événements CRITICAL',
    'Les alertes par email peuvent être configurées dans les paramètres',
  ],
};

export const ADMIN_SETTINGS: HelpContent = {
  pageId: 'admin-settings',
  pageName: 'Paramètres',
  title: 'Paramètres de la Plateforme',
  description: "Configurez les paramètres globaux de l'application.",
  sections: [
    {
      title: 'Configuration des labels',
      content:
        "Personnalisez les libellés affichés dans l'application (types d'événements, catégories de public, etc.).",
    },
    {
      title: 'Configuration du scoring',
      content:
        "Définissez les critères et pondérations utilisés pour évaluer les demandes d'inscription.",
    },
  ],
  faq: [
    {
      question: 'Les modifications sont-elles immédiates ?',
      answer:
        'Oui, les modifications sont appliquées instantanément et le cache est automatiquement invalidé.',
    },
  ],
  relatedLinks: [
    {
      label: 'Configuration du scoring',
      href: '/admin/scoring',
      description: 'Critères de sélection',
    },
  ],
};

export const ADMIN_SCORING: HelpContent = {
  pageId: 'admin-scoring',
  pageName: 'Configuration du scoring',
  title: 'Configuration du Scoring',
  description:
    "Définissez les critères et pondérations pour l'évaluation automatique des demandes d'inscription.",
  sections: [
    {
      title: 'Critères de scoring',
      content:
        "Chaque critère contribue au score final d'une demande. Plus le score est élevé, plus la demande est prioritaire.",
      steps: [
        "Catégorie de public correspondante : +points si l'événement cible le public de l'institution",
        'Première demande : +points pour les nouvelles institutions',
        "Taux de présence : +points selon l'historique de présence",
        'REP+ : +points pour les établissements prioritaires',
        "Historique des refus : +points si l'institution a souvent été refusée",
        'Éloignement géographique : +points pour les établissements éloignés',
      ],
    },
    {
      title: 'Pondérations',
      content:
        'Ajustez le poids de chaque critère entre -100% et +100%. Un poids négatif pénalise la demande.',
      steps: [
        'Faites glisser le curseur pour ajuster la pondération',
        "Cliquez sur l'œil pour activer/désactiver un critère",
        'Prévisualisez le résultat avec le bouton "Prévisualiser"',
      ],
    },
    {
      title: 'Score AESH',
      content:
        "Nombre d'AESH (Accompagnants d'Élèves en Situation de Handicap) déclarés dans le groupe. Plus ce nombre est élevé, plus le score augmente.",
    },
    {
      title: "Catégorie d'événement",
      content:
        "Bonus ou malus selon la correspondance entre les catégories de public de l'institution et celles de l'événement.",
    },
  ],
  faq: [
    {
      question: 'Comment le score est-il calculé ?',
      answer:
        'Le score est la somme des points obtenus pour chaque critère actif, multipliés par leur pondération respective.',
    },
    {
      question: 'Puis-je désactiver un critère temporairement ?',
      answer: "Oui, cliquez sur l'icône œil pour masquer un critère sans le supprimer.",
    },
    {
      question: "Qu'est-ce qu'un score négatif ?",
      answer:
        'Si une pondération est négative, le critère peut retirer des points. Un score final négatif est possible.',
    },
  ],
  relatedLinks: [
    { label: 'Guide de style', href: '/style-guide', description: 'Documentation des composants' },
  ],
  tips: [
    'Testez vos configurations avec la prévisualisation',
    'Les modifications affectent immédiatement les nouveaux scores',
  ],
};

export const ADMIN_IMPORT: HelpContent = {
  pageId: 'admin-import',
  pageName: "Import d'inscriptions",
  title: "Import d'Inscriptions Existantes",
  description: 'Importez des insérations existantes depuis un fichier Excel.',
  sections: [
    {
      title: 'Format du fichier',
      content:
        "Le fichier doit être au format .xlsx avec les colonnes requises : email de l'utilisateur, nom de l'institution, titre de l'événement, etc.",
    },
    {
      title: "Processus d'import",
      content: "L'import se déroule en plusieurs étapes.",
      steps: [
        'Téléchargez le fichier Excel',
        'Le système analyse et valide les données',
        'Les correspondances utilisateurs/institutions/événements sont automatiquement établies',
        'Un aperçu vous permet de vérifier avant confirmation',
        "L'import final crée les inscriptions",
      ],
    },
    {
      title: 'Validation des données',
      content:
        "Les erreurs potentielles sont détectées avant l'import : utilisateur introuvable, événement inexistant, etc.",
    },
  ],
  faq: [
    {
      question: 'Que se passe-t-il si une donnée est invalide ?',
      answer:
        "L'import signalera l'erreur et vous permettra de corriger le fichier avant de réessayer.",
    },
    {
      question: 'Puis-je annuler un import ?',
      answer: 'Non, mais vous pouvez supprimer manuellement les inscriptions créées si nécessaire.',
    },
  ],
  relatedLinks: [
    {
      label: 'Événements',
      href: '/admin/events',
      description: 'Vérifier les événements existants',
    },
    { label: 'Utilisateurs', href: '/admin/users', description: 'Vérifier les utilisateurs' },
  ],
  tips: [
    'Téléchargez le modèle de fichier pour connaître le format exact',
    "Vérifiez l'aperçu attentivement avant de confirmer",
  ],
};

export const ADMIN_BACKUP: HelpContent = {
  pageId: 'admin-backup',
  pageName: 'Sauvegardes',
  title: 'Gestion des Sauvegardes',
  description: 'Créez, comparez et restaurez des sauvegardes de la base de données.',
  sections: [
    {
      title: 'Créer une sauvegarde',
      content: 'Générez une sauvegarde complète de la base de données à tout moment.',
    },
    {
      title: 'Comparer les sauvegardes',
      content: 'Visualisez les différences entre deux sauvegardes pour identifier les changements.',
      steps: [
        'Sélectionnez deux sauvegardes à comparer',
        'Les différences sont affichées par table avec les enregistrements ajoutés, modifiés ou supprimés',
      ],
    },
    {
      title: 'Restaurer une sauvegarde',
      content:
        'Restaurez la base de données à un état antérieur. Attention : cette opération est irréversible.',
      steps: [
        'Sélectionnez la sauvegarde à restaurer',
        'Confirmez la restauration',
        'La base de données sera remplacée par le contenu de la sauvegarde',
      ],
    },
  ],
  faq: [
    {
      question: 'Combien de temps prend une sauvegarde ?',
      answer:
        'Cela dépend de la taille de la base de données, généralement quelques secondes à quelques minutes.',
    },
    {
      question: 'Les sauvegardes automatiques sont-elles activées ?',
      answer:
        "Configurez les sauvegardes automatiques via les tâches cron (contactez l'administrateur système).",
    },
    {
      question: 'Puis-je annuler une restauration ?',
      answer:
        'Non, la restauration est irréversible. Vérifiez bien la sauvegarde avant de confirmer.',
    },
  ],
  relatedLinks: [
    { label: 'Paramètres', href: '/admin/settings', description: 'Configuration de la plateforme' },
  ],
  tips: [
    'Effectuez une sauvegarde avant toute modification majeure',
    'Conservez plusieurs sauvegardes historiques',
  ],
};

// ============================================================================
// USER PAGES
// ============================================================================

export const HOME: HelpContent = {
  pageId: 'home',
  pageName: 'Accueil',
  title: "Bienvenue sur la Plateforme de l'Opéra",
  description: "Centralisez vos inscriptions aux événements de l'Opéra de Montpellier.",
  sections: [
    {
      title: 'À propos de cette plateforme',
      content:
        "Cette application permet aux écoles, associations et conservatoires de découvrir les événements de l'Opéra et de soumettre des demandes d'inscription.",
    },
    {
      title: 'Comment ça fonctionne ?',
      content: "Le processus d'inscription se déroule en plusieurs étapes.",
      steps: [
        'Découvrez les événements dans l\'onglet "Événements"',
        'Sélectionnez un événement et cliquez sur "S\'inscrire"',
        "Remplissez le formulaire d'inscription avec les détails de votre groupe",
        'Votre demande est automatiquement évaluée selon plusieurs critères',
        "Vous recevez une notification dès qu'une décision est prise",
      ],
    },
    {
      title: 'Suivi de vos demandes',
      content:
        'Consultez l\'état de vos inscriptions dans la section "Mon compte". Vous pouvez annuler une demande tant qu\'elle est en attente.',
    },
  ],
  faq: [
    {
      question: 'Qui peut utiliser cette plateforme ?',
      answer:
        "Les établissements scolaires, associations et conservatoires partenaires de l'Opéra de Montpellier.",
    },
    {
      question: 'Le service est-il gratuit ?',
      answer:
        "Oui, l'utilisation de la plateforme et l'inscription aux événements sont entièrement gratuits.",
    },
  ],
  relatedLinks: [
    { label: 'Voir les événements', href: '/events', description: 'Découvrir la programmation' },
    { label: 'Mon compte', href: '/account', description: 'Gérer mes informations' },
  ],
  tips: [
    'Inscrivez-vous tôt pour maximiser vos chances',
    'Remplissez soigneusement les informations sur votre groupe',
  ],
};

export const EVENTS: HelpContent = {
  pageId: 'events',
  pageName: 'Liste des événements',
  title: 'Les Événements',
  description:
    "Découvrez toute la programmation de l'Opéra de Montpellier pour la saison en cours.",
  sections: [
    {
      title: 'Navigation',
      content:
        'Parcourez les événements sous forme de liste ou de calendrier selon vos préférences.',
    },
    {
      title: 'Filtres et recherche',
      content: 'Utilisez les filtres pour trouver rapidement les événements qui vous intéressent.',
      steps: [
        'Filtrage par type (Opéra, Concert, etc.)',
        'Filtrage par catégorie de public (Maternelle, Collège, etc.)',
        'Recherche par titre ou mot-clé',
      ],
    },
    {
      title: 'Statut des événements',
      content: 'Les événements peuvent avoir différents statuts.',
      steps: [
        'OUVERT : Les inscriptions sont en cours',
        "FERMÉ : L'événement n'est pas encore ouvert aux inscriptions",
        'COMPLET : Toutes les places ont été attribuées',
      ],
    },
    {
      title: 'Accessibilité',
      content:
        'Chaque événement indique les accessibilités disponibles : malvoyant, moteur (PMR), malentendant, neurotypique.',
    },
  ],
  faq: [
    {
      question: "À quel moment les événements s'ouvrent-ils aux inscriptions ?",
      answer:
        "Les événements s'ouvrent progressivement selon les vacances scolaires. Consultez régulièrement la plateforme.",
    },
    {
      question: 'Comment savoir si un événement correspond à mon public ?',
      answer:
        'Chaque événement indique les catégories de public accueilli. Le filtre "Catégorie" vous montre uniquement les événements adaptés à votre public.',
    },
  ],
  relatedLinks: [
    { label: 'Mon compte', href: '/account', description: 'Voir mes inscriptions' },
    { label: 'Contact', href: '/contact', description: 'Une question ?' },
  ],
  tips: [
    'Utilisez le filtre catégorie pour voir uniquement les événements adaptés à votre public',
    'Cliquez sur un événement pour voir tous les détails',
  ],
};

export const EVENT_DETAIL: HelpContent = {
  pageId: 'event-detail',
  pageName: "Détail d'un événement",
  title: "Détail de l'Événement",
  description: "Toutes les informations sur un événement et son formulaire d'inscription.",
  sections: [
    {
      title: 'Informations pratiques',
      content:
        "Retrouvez le lieu, la durée, les dates et heures de représentation, et les informations d'accessibilité.",
    },
    {
      title: "S'inscrire",
      content:
        'Pour vous inscrire, cliquez sur le bouton "S\'inscrire" et remplissez le formulaire.',
      steps: [
        "Sélectionnez l'institution concernée (si vous en avez plusieurs)",
        "Indiquez le nombre d'élèves et d'accompagnateurs",
        'Cochez les cases correspondant aux handicaps/déficiences si applicable',
        "Précisez le nombre d'AESH accompagnants",
        'Ajoutez un commentaire si nécessaire',
      ],
    },
    {
      title: "Après l'inscription",
      content:
        "Votre demande sera évaluée automatiquement. Vous recevrez une notification par email et dans l'application dès qu'une décision est prise.",
    },
  ],
  faq: [
    {
      question: 'Puis-je annuler mon inscription ?',
      answer:
        'Oui, vous pouvez annuler tant que la demande est "En attente". Après confirmation, contactez l\'Opéra directement.',
    },
    {
      question: 'Combien de places puis-je réserver ?',
      answer:
        "Le nombre de places est limité et indiqué sur l'événement. Votre demande peut être partiellement acceptée.",
    },
    {
      question: 'Comment sont choisies les inscriptions acceptées ?',
      answer:
        'Les demandes sont évaluées selon plusieurs critères : correspondance de public, premières demandes, taux de présence historique, etc.',
    },
  ],
  relatedLinks: [
    { label: 'Retour aux événements', href: '/events', description: 'Voir toute la programmation' },
    { label: 'Mon compte', href: '/account', description: 'Gérer mes inscriptions' },
  ],
  tips: [
    'Remplissez toutes les informations avec précision',
    "N'hésitez pas à contacter l'Opéra si vous avez des questions spécifiques",
  ],
};

export const ACCOUNT: HelpContent = {
  pageId: 'account',
  pageName: 'Mon compte',
  title: 'Mon Compte',
  description: 'Gérez vos informations personnelles, vos institutions et vos inscriptions.',
  sections: [
    {
      title: 'Mes informations',
      content:
        'Modifiez vos nom, prénom, email et mot de passe. Vos informations sont sécurisées et ne sont jamais partagées.',
    },
    {
      title: 'Mes institutions',
      content:
        'Si vous appartenez à plusieurs institutions, vous pouvez les gérer ici et en ajouter de nouvelles.',
    },
    {
      title: 'Mes inscriptions',
      content: "Liste de toutes vos demandes d'inscription avec leur statut.",
      steps: [
        "EN ATTENTE : Votre demande est en cours d'évaluation",
        'CONFIRMÉE : Votre inscription a été acceptée',
        "REJETÉE : Votre demande n'a pas pu être acceptée",
        'ANNULÉE : Vous avez annulé votre demande',
      ],
    },
    {
      title: 'Historique',
      content: "Consultez l'historique de vos demandes passées et les taux de présence.",
    },
  ],
  faq: [
    {
      question: 'Puis-je changer mon institution ?',
      answer:
        'Vous pouvez vous ajouter à une nouvelle institution, mais vous ne pouvez pas quitter une institution si vous avez des inscriptions en cours.',
    },
    {
      question: 'Comment modifier mon mot de passe ?',
      answer: 'Cliquez sur "Modifier mon mot de passe" dans la section "Mes informations".',
    },
  ],
  relatedLinks: [
    { label: 'Événements', href: '/events', description: 'Découvrir la programmation' },
    { label: 'Contact', href: '/contact', description: "Besoin d'aide ?" },
  ],
  tips: [
    'Gardez vos informations à jour pour faciliter les démarches',
    "Vérifiez régulièrement l'état de vos inscriptions",
  ],
};

export const ACCOUNT_REGISTRATIONS: HelpContent = {
  pageId: 'account-registrations',
  pageName: 'Mes inscriptions',
  title: 'Mes Inscriptions',
  description: "Gérez et suivez toutes vos demandes d'inscription aux événements.",
  sections: [
    {
      title: 'Liste des inscriptions',
      content: 'Toutes vos demandes sont affichées ici, triables par statut et par date.',
    },
    {
      title: "Détails d'une inscription",
      content:
        'Cliquez sur une inscription pour voir tous les détails : nombre de places, groupes, commentaire, etc.',
    },
    {
      title: 'Annulation',
      content:
        "Vous pouvez annuler une demande tant qu'elle est \"En attente\". Après confirmation, contactez l'équipe de l'Opéra.",
    },
    {
      title: 'Documents',
      content: 'Téléchargez les documents PDF associés à vos inscriptions confirmées.',
    },
  ],
  faq: [
    {
      question: 'Que signifie "En attente" ?',
      answer:
        "Votre demande est en cours d'évaluation. Vous recevrez une notification dès qu'une décision est prise.",
    },
    {
      question: 'Pourquoi ma demande a-t-elle été rejetée ?',
      answer:
        "Les demandes sont évaluées selon plusieurs critères et les places sont limitées. N'hésitez pas à réessayer pour un autre événement.",
    },
  ],
  relatedLinks: [
    { label: 'Événements', href: '/events', description: "Découvrir d'autres événements" },
    { label: 'Mon compte', href: '/account', description: 'Gérer mes informations' },
  ],
  tips: [
    "Vérifiez régulièrement l'état de vos demandes",
    "Téléchargez les documents de confirmation avant l'événement",
  ],
};

export const ACCOUNT_GROUPS: HelpContent = {
  pageId: 'account-groups',
  pageName: 'Mes groupes',
  title: 'Gestion de mes Groupes',
  description: 'Créez et gérez vos groupes/classes pour faciliter les inscriptions.',
  sections: [
    {
      title: "Qu'est-ce qu'un groupe ?",
      content:
        "Un groupe représente une classe ou un ensemble d'élèves que vous inscrivez régulièrement aux événements.",
    },
    {
      title: 'Créer un groupe',
      content:
        "Définissez les caractéristiques de votre groupe : nom, nombre d'élèves, catégories de public, etc.",
    },
    {
      title: 'Utiliser un groupe',
      content:
        "Lors d'une inscription, sélectionnez un groupe pré-enregistré pour remplir automatiquement le formulaire.",
    },
  ],
  faq: [
    {
      question: 'Puis-je modifier un groupe existant ?',
      answer:
        "Oui, vous pouvez modifier un groupe à tout moment. Cela n'affecte pas les inscriptions déjà effectuées.",
    },
    {
      question: 'Combien de groupes puis-je créer ?',
      answer:
        "Il n'y a pas de limite. Créez autant de groupes que nécessaire pour organiser vos classes.",
    },
  ],
  relatedLinks: [
    { label: 'Mes inscriptions', href: '/account/registrations', description: 'Voir mes demandes' },
    { label: 'Événements', href: '/events', description: "S'inscrire à un événement" },
  ],
  tips: [
    'Créez des groupes pour chaque classe ou niveau',
    "Mettez à jour les effectifs en début d'année scolaire",
  ],
};

export const ACCOUNT_INSTITUTIONS: HelpContent = {
  pageId: 'account-institutions',
  pageName: 'Mes institutions',
  title: 'Gestion de mes Institutions',
  description: 'Consultez et gérez les établissements auxquels vous êtes associé.',
  sections: [
    {
      title: 'Mes institutions',
      content:
        'Liste des établissements (écoles, associations, conservatoires) auxquels vous êtes rattaché.',
    },
    {
      title: 'Demander une nouvelle institution',
      content:
        "Si votre établissement n'est pas listé, vous pouvez en faire la demande. Un administrateur validera votre demande.",
      steps: [
        'Cliquez sur "Ajouter une institution"',
        'Recherchez votre établissement par nom ou ville',
        "S'il n'existe pas, remplissez le formulaire de création",
        "Attendez la validation par l'administrateur",
      ],
    },
    {
      title: 'Historique par institution',
      content:
        "Pour chaque institution, visualisez l'historique des demandes, le taux de présence et la dernière activité.",
    },
  ],
  faq: [
    {
      question: 'Puis-je supprimer une institution ?',
      answer:
        "Vous pouvez vous retirer d'une institution si vous n'avez pas d'inscriptions en cours pour celle-ci.",
    },
    {
      question: "Que faire si mon établissement n'existe pas ?",
      answer:
        "Faites une demande de création via le formulaire. Un administrateur validera l'ajout.",
    },
  ],
  relatedLinks: [
    { label: 'Mon compte', href: '/account', description: 'Retour à mon compte' },
    { label: 'Contact', href: '/contact', description: "Contacter l'équipe" },
  ],
  tips: [
    "Vérifiez que l'institution n'existe pas déjà avant de créer une demande",
    'Gardez vos informations institutionnelles à jour',
  ],
};

// ============================================================================
// AUTH PAGES
// ============================================================================

export const LOGIN: HelpContent = {
  pageId: 'login',
  pageName: 'Connexion',
  title: 'Connexion',
  description: 'Connectez-vous à votre compte pour accéder à la plateforme.',
  sections: [
    {
      title: 'Se connecter',
      content: 'Entrez votre email et votre mot de passe pour vous connecter.',
      steps: [
        "Votre email est l'adresse utilisée lors de l'inscription",
        'Le mot de passe doit comporter au moins 10 caractères',
        'Cochez "Se souvenir de moi" pour rester connecté',
      ],
    },
    {
      title: 'Mot de passe oublié ?',
      content:
        'Cliquez sur "Mot de passe oublié" pour recevoir un lien de réinitialisation par email.',
    },
    {
      title: 'Première connexion ?',
      content:
        "Si vous n'avez pas encore de compte, vous devez vous inscrire via le formulaire dédié.",
    },
  ],
  faq: [
    {
      question: 'Je ne peux pas me connecter, que faire ?',
      answer:
        'Vérifiez votre email et mot de passe. Si vous avez oublié votre mot de passe, utilisez la fonction de réinitialisation. Après plusieurs tentatives infructueuses, votre compte peut être temporairement verrouillé.',
    },
    {
      question: 'Mon compte est verrouillé, comment faire ?',
      answer:
        "Attendez 1 heure ou contactez l'administrateur pour déverrouiller votre compte manuellement.",
    },
  ],
  relatedLinks: [
    { label: "S'inscrire", href: '/auth/register', description: 'Créer un compte' },
    { label: 'Mot de passe oublié', href: '/auth/reset-password', description: 'Réinitialiser' },
  ],
  tips: ['Utilisez un mot de passe fort et unique', 'Ne partagez jamais vos identifiants'],
};

export const REGISTER: HelpContent = {
  pageId: 'register',
  pageName: 'Inscription',
  title: 'Créer un Compte',
  description:
    "Créez votre compte pour commencer à inscrire vos groupes aux événements de l'Opéra.",
  sections: [
    {
      title: 'Informations personnelles',
      content:
        'Remplissez vos nom, prénom et email. Ces informations seront utilisées pour vous contacter.',
    },
    {
      title: 'Mot de passe',
      content:
        'Choisissez un mot de passe sécurisé avec au moins 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
    },
    {
      title: 'Institution',
      content:
        'Sélectionnez ou créez votre institution (établissement scolaire, association, conservatoire).',
      steps: [
        'Recherchez votre institution par nom ou ville',
        "Si elle n'existe pas, créez-la en remplissant le formulaire",
        'Vous pouvez ajouter plusieurs institutions si nécessaire',
      ],
    },
    {
      title: "Vérification de l'email",
      content:
        "Après l'inscription, vous recevrez un email de vérification. Cliquez sur le lien pour activer votre compte.",
    },
  ],
  faq: [
    {
      question: "Qui peut s'inscrire ?",
      answer:
        "Les professionnels des établissements scolaires, associations et conservatoires partenaires de l'Opéra de Montpellier.",
    },
    {
      question: "Je n'ai pas reçu l'email de vérification",
      answer:
        'Vérifiez vos courriers indésirables. Si vous ne le trouvez pas, demandez un nouvel email de vérification.',
    },
  ],
  relatedLinks: [
    { label: 'Se connecter', href: '/auth/login', description: 'Déjà un compte ?' },
    { label: 'Contact', href: '/contact', description: "Besoin d'aide ?" },
  ],
  tips: [
    'Utilisez votre email professionnel',
    "Choisissez un mot de passe que vous n'utilisez pas ailleurs",
  ],
};

// ============================================================================
// OTHER PAGES
// ============================================================================

export const LEGAL_NOTICES: HelpContent = {
  pageId: 'legal-notices',
  pageName: 'Mentions légales',
  title: 'Mentions Légales',
  description: 'Informations légales sur la plateforme.',
  sections: [
    {
      title: 'Éditeur de la plateforme',
      content: 'Opéra de Montpellier - Opéra Orchestre National Montpellier',
    },
    {
      title: 'Données personnelles',
      content:
        'Les données collectées sont utilisées uniquement pour la gestion des inscriptions et ne sont pas partagées avec des tiers.',
    },
    {
      title: 'Cookies',
      content: 'La plateforme utilise des cookies techniques nécessaires à son fonctionnement.',
    },
  ],
  faq: [
    {
      question: 'Comment exercer mes droits RGPD ?',
      answer:
        "Contactez-nous via le formulaire de contact pour exercer vos droits d'accès, de rectification ou de suppression.",
    },
  ],
};

export const CONTACT: HelpContent = {
  pageId: 'contact',
  pageName: 'Contact',
  title: 'Nous Contacter',
  description: "Une question ? Besoin d'aide ? Contactez l'équipe de l'Opéra.",
  sections: [
    {
      title: 'Formulaire de contact',
      content:
        'Remplissez le formulaire avec votre question. Nous vous répondrons dans les plus brefs délais.',
    },
    {
      title: 'Coordonnées',
      content: 'Opéra de Montpellier - Opéra Orchestre National Montpellier',
    },
  ],
  tips: [
    'Précisez votre institution et le contexte de votre demande',
    'Pour les questions urgentes, appelez directement le service concerné',
  ],
};

export const STYLE_GUIDE: HelpContent = {
  pageId: 'style-guide',
  pageName: 'Guide de style',
  title: 'Guide de Style',
  description: "Documentation des composants et styles de l'application.",
  sections: [
    {
      title: 'Composants UI',
      content:
        "Tous les composants réutilisables de l'interface : boutons, formulaires, cartes, modales, etc.",
    },
    {
      title: 'Couleurs et typographie',
      content: "Palette de couleurs et polices utilisées dans l'application.",
    },
    {
      title: 'Conventions',
      content: "Règles de nommage et d'organisation des composants.",
    },
  ],
  relatedLinks: [{ label: 'Accueil', href: '/', description: "Retour à l'accueil" }],
};

// ============================================================================
// EXPORT ALL CONTENTS
// ============================================================================

export const HELP_CONTENTS: HelpContentsMap = {
  // Admin pages
  'admin-dashboard': ADMIN_DASHBOARD,
  'admin-events': ADMIN_EVENTS,
  'admin-users': ADMIN_USERS,
  'admin-institutions': ADMIN_INSTITUTIONS,
  'admin-statistics': ADMIN_STATISTICS,
  'admin-security': ADMIN_SECURITY,
  'admin-settings': ADMIN_SETTINGS,
  'admin-scoring': ADMIN_SCORING,
  'admin-import': ADMIN_IMPORT,
  'admin-backup': ADMIN_BACKUP,

  // User pages
  home: HOME,
  events: EVENTS,
  'event-detail': EVENT_DETAIL,
  account: ACCOUNT,
  'account-registrations': ACCOUNT_REGISTRATIONS,
  'account-groups': ACCOUNT_GROUPS,
  'account-institutions': ACCOUNT_INSTITUTIONS,

  // Auth pages
  login: LOGIN,
  register: REGISTER,

  // Other pages
  'legal-notices': LEGAL_NOTICES,
  contact: CONTACT,
  'style-guide': STYLE_GUIDE,
};

// Export a helper function to get content by page ID
export const getHelpContent = (pageId: string): HelpContent | undefined => {
  return HELP_CONTENTS[pageId];
};
