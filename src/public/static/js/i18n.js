/**
 * Lightweight bilingual layer (FR ⇄ EN).
 *
 * The UI has historically mixed French and English. Instead of rewriting every
 * template, we keep the source text and translate the rendered DOM in place:
 *  - the original text of every node/attribute is remembered
 *  - switching language either restores the original or applies the counterpart
 *  - a MutationObserver translates content rendered after the switch
 *  - same-origin widget iframes are translated through their contentDocument
 *
 * The dictionary is bidirectional: French sources are translated to English and
 * English sources to French, so both the legacy widgets and the newer English
 * ones follow the switch.
 */

const STORAGE_KEY = 'uiLang';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

/** [fr, en] pairs. Keep the most specific strings first when phrases overlap. */
const PAIRS = [
  // Shell / navigation
  ['Onglets', 'Tabs'],
  ['Onglet', 'Tab'],
  ['Nouvel onglet', 'New tab'],
  ['Créer un onglet', 'Create a tab'],
  ['Nom de l’onglet', 'Tab name'],
  ['Nom de l\'onglet', 'Tab name'],
  ['Mon super projet', 'My project'],
  ['Système personnel', 'Personal OS'],
  ['Finances personnelles', 'Personal Finance'],
  ['Terminal finance', 'Finance Terminal'],
  ['Labo IA', 'AI Lab'],
  ['Études', 'School'],
  ['Aucun onglet', 'No tabs'],
  ['Sélectionner un onglet', 'Select a tab'],
  ['Crée un nouvel onglet pour commencer', 'Create a new tab to get started'],
  ['+ Créer un onglet', '+ Create a tab'],
  ['Réduire le menu', 'Collapse menu'],
  ['Centre de notifications', 'Notification center'],
  ['Mode confidentialité', 'Privacy mode'],
  ['Agrandir un widget', 'Expand a widget'],
  ['Mode édition', 'Edit mode'],
  ['Liste des Widgets', 'Widget list'],
  ['Créer Widget', 'Create Widget'],
  ['Ajouter Page', 'Add page'],
  ['Ajouter une page', 'Add page'],
  ['Paramètres', 'Settings'],
  ['Paramètres de l\'onglet', 'Tab settings'],
  ['Terminer', 'Done'],
  ['Scripts', 'Scripts'],
  ['Script', 'Script'],
  ['Général', 'General'],

  // Generic actions
  ['Créer', 'Create'],
  ['Ajouter', 'Add'],
  ['Vous', 'You'],
  ['Ajouter une', 'Add a'],
  ['Supprimer', 'Delete'],
  ['Retirer', 'Remove'],
  ['Renommer', 'Rename'],
  ['Éditer', 'Edit'],
  ['Editer', 'Edit'],
  ['Modifier', 'Edit'],
  ['Enregistrer', 'Save'],
  ['Sauvegarder', 'Save'],
  ['Sauvegarder les paramètres', 'Save settings'],
  ['Annuler', 'Cancel'],
  ['Fermer', 'Close'],
  ['Ouvrir', 'Open'],
  ['Rechercher', 'Search'],
  ['Rechercher...', 'Search...'],
  ['🔍 Rechercher...', '🔍 Search...'],
  ['Rechercher un preset...', 'Search presets...'],
  ['🔍 Rechercher un preset...', '🔍 Search presets...'],
  ['Aucun résultat', 'No results'],
  ['Aucun résultat.', 'No results.'],
  ['Chargement...', 'Loading...'],
  ['Chargement…', 'Loading…'],
  ['Aperçu', 'Preview'],
  ['Résumé', 'Summary'],
  ['Schéma', 'Schema'],
  ['Pointillés', 'Dotted'],
  ['Épaisseur', 'Width'],
  ['Épaisse (3px)', 'Thick (3px)'],
  ['Très épaisse (4px)', 'Extra thick (4px)'],
  ['Carré (0px)', 'Square (0px)'],
  ['Léger (4px)', 'Slight (4px)'],
  ['Très arrondi (12px)', 'Extra round (12px)'],
  ['Très arrondi (16px)', 'Extra round (16px)'],
  ['Légères', 'Light'],
  ['Bouton', 'Button'],

  // Widget gallery / categories
  ['Aucun widget créé', 'No widgets yet'],
  ['Créer votre premier widget', 'Create your first widget'],
  ['🔧 Créer votre premier widget', '🔧 Create your first widget'],
  ['Aucun widget trouvé', 'No widgets found'],
  ['La corbeille est vide', 'Trash is empty'],
  ['Tous les widgets', 'All widgets'],
  ['Non catégorisés', 'Uncategorized'],
  ['Graphiques & Visualisations', 'Charts & Visualizations'],
  ['Tableaux & Listes', 'Tables & Lists'],
  ['Outils & Utilitaires', 'Tools & Utilities'],
  ['Contrôles & Formulaires', 'Controls & Forms'],
  ['Autres', 'Other'],
  ['Corbeille', 'Trash'],
  ['Vider la corbeille', 'Empty trash'],
  ['Restaurer', 'Restore'],
  ['Éditer le widget', 'Edit widget'],
  ['Changer l\'icône', 'Change icon'],
  ['Changer l\'emoji', 'Change emoji'],
  ['Gérer les catégories', 'Manage categories'],
  ['➕ Ajouter une catégorie', '➕ Add a category'],
  ['Ajouter une catégorie', 'Add a category'],
  ['Nom de la catégorie', 'Category name'],
  ['Les catégories "Tous les widgets" et "Autres" ne peuvent pas être modifiées',
    'The "All widgets" and "Other" categories cannot be edited'],
  ['💡 Les catégories "Tous les widgets" et "Autres" ne peuvent pas être modifiées',
    '💡 The "All widgets" and "Other" categories cannot be edited'],

  // Create / add widget flow
  ['Créer un nouveau widget', 'Create a new widget'],
  ['🔧 Créer un nouveau widget', '🔧 Create a new widget'],
  ['Nom du widget', 'Widget name'],
  ['Graphique des capteurs', 'Sensor chart'],
  ['Créer et ouvrir avec OpenCode', 'Create & open with OpenCode'],
  ['Ajouter un widget', 'Add a widget'],
  ['➕ Ajouter un widget', '➕ Add a widget'],
  ['Widget créé', 'Widget created'],
  ['Widget ajouté', 'Widget added'],
  ['Widget retiré', 'Widget removed'],
  ['Widget renommé', 'Widget renamed'],
  ['Widget restauré', 'Widget restored'],
  ['Widget supprimé', 'Widget deleted'],
  ['Positions sauvegardées', 'Positions saved'],
  ['Configuration enregistrée', 'Configuration saved'],
  ['Paramètres sauvegardés', 'Settings saved'],
  ['Erreur lors de la création du widget', 'Could not create the widget'],
  ['Éditer avec OpenCode', 'Edit with OpenCode'],
  ['💬 Éditer avec OpenCode', '💬 Edit with OpenCode'],
  ['Backups', 'Backups'],
  ['Permissions', 'Permissions'],
  ['Résolution de l\'aperçu', 'Preview resolution'],
  ['Taille réelle du widget', 'Actual widget size'],
  ['Vue mobile', 'Mobile view'],
  ['Vue tablette', 'Tablet view'],
  ['Rafraîchir', 'Refresh'],
  ['ID copié !', 'ID copied!'],
  ['✓ Copié!', '✓ Copied!'],
  ['Ce widget n\'a pas de paramètres configurables.', 'This widget has no configurable settings.'],

  // Database / permissions
  ['Base de données SQLite', 'SQLite database'],
  ['🗄️ Base de données SQLite', '🗄️ SQLite database'],
  ['Gérez vos tables et explorez les données', 'Manage tables and explore the data'],
  ['Gestion de la base de données', 'Database management'],
  ['Cliquez sur une table à gauche pour explorer ses données ou modifier son schéma.',
    'Click a table on the left to explore its data or edit its schema.'],
  ['Les permissions pour les widgets se configurent dans les paramètres de chaque widget.',
    'Widget permissions are configured in each widget\'s settings.'],
  ['Tables disponibles', 'Available tables'],
  ['📊 Tables disponibles', '📊 Available tables'],
  ['+ Nouvelle table', '+ New table'],
  ['Créer une nouvelle table', 'Create a table'],
  ['➕ Créer une nouvelle table', '➕ Create a table'],
  ['Nom de la table', 'Table name'],
  ['Minuscules, lettres, chiffres et underscores uniquement', 'Lowercase letters, numbers and underscores only'],
  ['Colonnes', 'Columns'],
  ['+ Ajouter une colonne', '+ Add column'],
  ['✓ Créer la table', '✓ Create table'],
  ['Modifier la table', 'Edit table'],
  ['⚙️ Modifier la table', '⚙️ Edit table'],
  ['Modifier le schéma', 'Edit schema'],
  ['⚙️ Modifier le schéma', '⚙️ Edit schema'],
  ['Colonnes actuelles', 'Current columns'],
  ['Ajouter des colonnes', 'Add columns'],
  ['✓ Sauvegarder les modifications', '✓ Save changes'],
  ['Ajouter une ligne', 'Add row'],
  ['➕ Ajouter une ligne', '➕ Add row'],
  ['✓ Sauvegarder', '✓ Save'],
  ['Sauvegardes', 'Backups'],
  ['+ Créer une sauvegarde', '+ Create backup'],
  ['Créer une sauvegarde', 'Create a backup'],
  ['Créer backup', 'Create backup'],
  ['💾 Créer backup', '💾 Create backup'],
  ['Backup manuel', 'Manual backup'],
  ['💾 Backup manuel', '💾 Manual backup'],
  ['Backup créé', 'Backup created'],
  ['Backup restauré', 'Backup restored'],
  ['Erreur lors de la restauration', 'Restore failed'],
  ['Restaurer ce backup ? Les modifications non sauvegardées seront perdues.', 'Restore this backup? Unsaved changes will be lost.'],
  ['Confirmer', 'Confirm'],
  ['Aucun backup', 'No backups'],
  ['fichier(s)', 'file(s)'],
  ['fichiers', 'files'],
  ['Sauvegarder les paramètres', 'Save settings'],
  ['Tables de la base', 'Database tables'],
  ['🗄️ Tables de la base', '🗄️ Database tables'],
  ['Assignées', 'Assigned'],
  ['Assignés', 'Assigned'],
  ['← Retour', '← Back'],
  ['Retour', 'Back'],
  ['Disponibles', 'Available'],
  ['Aucune table assignée à ce widget.', 'No table assigned to this widget.'],
  ['Assignez des tables depuis la liste à gauche pour qu\'OpenCode puisse y accéder.',
    'Assign tables from the left list so OpenCode can access them.'],
  ['Cliquez', 'Click'],
  ['pour assigner une table au widget, ou cliquez sur une table assignée pour l\'explorer.',
    'to assign a table to the widget, or click an assigned table to explore it.'],
  ['Auto-modifier des tables', 'Auto-modify tables'],
  ['OpenCode pourra ajouter/modifier des colonnes dans les tables existantes.',
    'OpenCode can add or modify columns in existing tables.'],
  ['Permissions & Options', 'Permissions & options'],
  ['🔒 Permissions & Options', '🔒 Permissions & options'],
  ['Contrôlez ce qu\'OpenCode peut faire automatiquement avec la base de données.',
    'Control what OpenCode can do automatically with the database.'],
  ['Auto-créer des tables', 'Auto-create tables'],
  ['OpenCode pourra créer de nouvelles tables sans demander votre approbation.',
    'OpenCode can create new tables without asking for approval.'],
  ['Si désactivé, OpenCode décrira les modifications nécessaires et attendra votre approbation.',
    'If disabled, OpenCode will describe the required changes and wait for your approval.'],
  ['La table sera automatiquement assignée à ce widget après création.',
    'The table will be assigned to this widget after creation.'],
  ['Les widgets autorisés peuvent afficher des notifications toast à l\'utilisateur (alertes, erreurs, etc.)',
    'Authorized widgets can show toast notifications (alerts, errors, etc.)'],
  ['pour assigner une table au widget, ou cliquez sur une table assignée pour l\'explorer.',
    'to assign a table to the widget, or click an assigned table to explore it.'],
  ['Table assignée au widget', 'Table assigned to the widget'],
  ['Table retirée du widget', 'Table removed from the widget'],
  ['Permission ajoutée', 'Permission added'],
  ['Table créée', 'Table created'],
  ['Ligne ajoutée', 'Row added'],
  ['Ligne modifiée', 'Row updated'],
  ['Ligne supprimée', 'Row deleted'],
  ['Aucune permission sélectionnée', 'No permission selected'],
  ['Cette table a déjà une permission configurée', 'This table already has a permission configured'],
  ['Veuillez sélectionner une table', 'Please select a table'],
  ['Veuillez sélectionner au moins une action', 'Please select at least one action'],
  ['Aucune modification à effectuer', 'No changes to apply'],
  ['✓ Table créée avec succès', '✓ Table created successfully'],
  ['✓ Table modifiée avec succès', '✓ Table updated successfully'],
  ['✓ Ligne ajoutée', '✓ Row added'],
  ['✓ Ligne modifiée', '✓ Row updated'],
  ['Erreur lors du chargement des données', 'Could not load data'],
  ['Erreur lors du chargement du schéma', 'Could not load schema'],

  // Table proposal
  ['Proposition de table par OpenCode', 'Table proposal from OpenCode'],
  ['📋 Proposition de table par OpenCode', '📋 Table proposal from OpenCode'],
  ['OpenCode souhaite créer une nouvelle table', 'OpenCode wants to create a new table'],
  ['Refuser', 'Reject'],
  ['✓ Approuver et créer', '✓ Approve & create'],
  ['Proposition refusée', 'Proposal rejected'],
  ['⏳ Création en cours...', '⏳ Creating...'],
  ['🚫 Proposition refusée', '🚫 Proposal rejected'],

  // Tab settings / variables / pages
  ['Modifier l\'onglet', 'Edit tab'],
  ['✏️ Modifier l\'onglet', '✏️ Edit tab'],
  ['Variables partagées entre widgets', 'Shared variables between widgets'],
  ['🔗 Variables partagées entre widgets', '🔗 Shared variables between widgets'],
  ['Les widgets de cet onglet peuvent lire et modifier ces variables pour communiquer entre eux.',
    'Widgets on this tab can read and write these variables to talk to each other.'],
  ['nom_variable', 'variable_name'],
  ['valeur', 'value'],
  ['Variables partagées', 'Shared variables'],
  ['Nom de la variable', 'Variable name'],
  ['Valeur', 'Value'],
  ['Ajouter une variable', 'Add variable'],
  ['Aucune variable définie', 'No variables defined'],
  ['Ajouter une page', 'Add page'],
  ['Nom de la page', 'Page name'],
  ['Page ajoutée', 'Page added'],

  // Style modal
  ['Style de l\'onglet', 'Tab style'],
  ['🎨 Style de l\'onglet', '🎨 Tab style'],
  ['Couleurs', 'Colors'],
  ['🎨 Couleurs', '🎨 Colors'],
  ['Primaire', 'Primary'],
  ['Secondaire', 'Secondary'],
  ['Fond', 'Background'],
  ['Texte', 'Text'],
  ['Police', 'Font'],
  ['✏️ Typographie', '✏️ Typography'],
  ['🔲 Bordures & Ombres', '🔲 Borders & Shadows'],
  ['BORDURES & OMBRES', 'BORDERS & SHADOWS'],
  ['Solide', 'Solid'],
  ['Rayon', 'Radius'],
  ['Ombres', 'Shadows'],
  ['Moyennes', 'Medium'],
  ['Aucune', 'None'],
  ['Fine (1px)', 'Thin (1px)'],
  ['Moyenne (2px)', 'Medium (2px)'],
  ['Arrondi (8px)', 'Rounded (8px)'],
  ['Aperçu du style configuré pour vos widgets.', 'Preview of the style configured for your widgets.'],
  ['Appliquer le thème à la sidebar et au header', 'Apply the theme to the sidebar and header'],
  ['Preset sauvegardé !', 'Preset saved!'],
  ['Preset supprimé', 'Preset deleted'],
  ['Style sauvegardé', 'Style saved'],

  // Scripts
  ['▶️ Exécuter', '▶️ Run'],
  ['Exécuter', 'Run'],
  ['Exécutez le script pour voir les logs ici...', 'Run the script to see logs here...'],
  ['⚡ Déclencheurs', '⚡ Triggers'],
  ['Déclencheurs', 'Triggers'],
  ['🔄 Rafraîchir', '🔄 Refresh'],
  ['Auto-approuver création', 'Auto-approve creation'],
  ['Aucune exécution', 'No runs'],
  ['Aucune exécution', 'No runs'],
  ['Script exécuté', 'Script ran'],
  ['Script créé', 'Script created'],
  ['Script sauvegardé', 'Script saved'],
  ['Traitement terminé', 'Processing complete'],
  ['Script terminé', 'Script complete'],
  ['Exécution en cours...', 'Running...'],
  ['Exécuté avec succès', 'Ran successfully'],
  ['Erreur d\'exécution', 'Execution error'],
  ['jamais exécuté', 'never run'],
  ['Tous les jours à', 'Every day at'],
  ['Nom du script', 'Script name'],
  ['Mon script de données', 'My data script'],

  // Notifications / demo banner
  ['Mode démo', 'Demo mode'],
  ['🎭 Mode Démo', '🎭 Demo mode'],
  ['Onglets isolés · Données fictives · Toutes les fonctions d\'édition sont actives',
    'Isolated tabs · Fictional data · All editing features are enabled'],
  ['Mode démo — onglets isolés, données fictives, widgets réels disponibles',
    'Demo mode — isolated tabs, fictional data, real widgets available'],
  ['Daily brief ready', 'Daily brief ready'],
  ['Backup completed', 'Backup completed'],

  // Generic widget vocabulary (used by the legacy French widgets)
  ['Aujourd\'hui', 'Today'],
  ['Aujourd’hui', 'Today'],
  ['Hier', 'Yesterday'],
  ['Demain', 'Tomorrow'],
  ['Créé:', 'Created:'],
  ['Créé :', 'Created:'],
  ['Modifié:', 'Updated:'],
  ['Modifié :', 'Updated:'],
  ['Nouvelle tâche…', 'New task…'],
  ['Nouvelle tâche...', 'New task...'],
  ['Supprimer terminées', 'Clear completed'],
  ['Cartes prêtes', 'Cards ready'],
  ['Réponse...', 'Answer...'],
  ['Révéler la réponse', 'Reveal answer'],
  ['Comment te sens-tu ?', 'How do you feel?'],
  ['Oubli total', 'Total blank'],
  ['Oubli', 'Forgot'],
  ['Hésitant', 'Unsure'],
  ['Moyen', 'Okay'],
  ['Je sais', 'Know it'],
  ['Automatique', 'Automatic'],
  ['Carte suivante', 'Next card'],
  ['Passer', 'Skip'],
  ['Quitter', 'Exit'],
  ['➕ Ajouter une carte', '➕ Add a card'],
  ['Question (Front)', 'Question (front)'],
  ['Réponse (Back)', 'Answer (back)'],
  ['Tags (optionnel, séparés par ;)', 'Tags (optional, separated by ;)'],
  ['Créer carte', 'Create card'],
  ['⚙️ Gérer cartes', '⚙️ Manage cards'],
  ['🔍 Chercher cartes...', '🔍 Search cards...'],
  ['Routine Matin', 'Morning routine'],
  ['Routine Soir', 'Evening routine'],
  ['Routine complète — Bonne journée !', 'Routine complete — Have a good day!'],
  ['Calendrier de Vie', 'Life Calendar'],
  ['🌍 Calendrier de Vie', '🌍 Life Calendar'],
  ['Nouvelle ère', 'New era'],
  ['🌅 Nouvelle ère', '🌅 New era'],
  ['Nouvelle étape de vie', 'New life milestone'],
  ['📌 Nouvelle étape de vie', '📌 New life milestone'],
  ['C\'est mon ère actuelle', 'This is my current era'],
  ['Déjà accompli', 'Already achieved'],
  ['Aucune image sélectionnée', 'No image selected'],
  ['Voyage', 'Travel'],
  ['Amour', 'Love'],
  ['Éducation', 'Education'],
  ['Famille', 'Family'],
  ['Santé', 'Health'],
  ['Carrière', 'Career'],
  ['Autre', 'Other'],
  ['Vision Board', 'Vision board'],
  ['Icône', 'Icon'],
  ['Couleur', 'Color'],
  ['Image principale', 'Cover image'],
  ['Nom', 'Name'],
  ['Date', 'Date'],
  ['Description', 'Description'],
  ['Début (année)', 'Start (year)'],
  ['Fin (année)', 'End (year)'],
  ['Mois de début', 'Start month'],
  ['Mois de fin', 'End month'],
  ['Ère associée', 'Linked era'],
  ['Glisse des images ici ou', 'Drop images here or'],
  ['parcourir', 'browse'],
  ['Sauvegarder', 'Save'],
  ['Janvier', 'January'], ['Février', 'February'], ['Mars', 'March'],
  ['Avril', 'April'], ['Mai', 'May'], ['Juin', 'June'],
  ['Juillet', 'July'], ['Août', 'August'], ['Septembre', 'September'],
  ['Octobre', 'October'], ['Novembre', 'November'], ['Décembre', 'December'],
  ['Lundi', 'Monday'], ['Mardi', 'Tuesday'], ['Mercredi', 'Wednesday'],
  ['Jeudi', 'Thursday'], ['Vendredi', 'Friday'], ['Samedi', 'Saturday'], ['Dimanche', 'Sunday'],
  ['Aucun événement.', 'No events.'],
  ['Cliquez sur + pour en ajouter.', 'Click + to add one.'],

  // New English widgets → French (for the French mode)
  ['Dépensé', 'Spent'],
  ['Restant', 'Remaining'],
  ['du budget', 'of budget'],
  ['Patrimoine net', 'Net worth'],
  ['Actifs', 'Assets'],
  ['Dettes', 'Liabilities'],
  ['Objectifs d\'épargne', 'Savings goals'],
  ['Total épargné', 'Total saved'],
  ['Abonnements mensuels', 'Monthly subscriptions'],
  ['Par mois', 'Per month'],
  ['Prochain prélèvement', 'Next charge'],
  ['Devoirs', 'Assignments'],
  ['À rendre cette semaine', 'Due this week'],
  ['Terminés', 'Completed'],
  ['À venir', 'Upcoming'],
  ['Notes', 'Grades'],
  ['Moyenne', 'Average'],
  ['Crédits', 'Credits'],
  ['Emploi du temps', 'Timetable'],
  ['Compte à rebours', 'Countdown'],
  ['jours restants', 'days left'],
  ['Cette semaine', 'This week'],
  ['En retard', 'Overdue'],
  ['En cours', 'In progress'],
  ['Non commencé', 'Not started'],
  ['Basse', 'Low'],
  ['Moyen', 'Medium'],
  ['Haute', 'High'],
  ['Hebdomadaire', 'Weekly'],
  ['Mensuel', 'Monthly'],
  ['Annuel', 'Yearly'],
  ['Logement', 'Housing'],
  ['Courses', 'Groceries'],
  ['Restaurants', 'Dining out'],
  ['Loisirs', 'Fun'],
  ['Épargne', 'Savings'],
  ['Fonds d\'urgence', 'Emergency fund'],
  ['Voyage au Japon', 'Japan trip'],
  ['Nouvel ordinateur', 'New laptop'],
  ['Apport immobilier', 'House down payment'],
  ['Compte courant', 'Checking'],
  ['Courtage', 'Brokerage'],
  ['Voiture', 'Car'],
  ['Prêt étudiant', 'Student loan'],
  ['Carte de crédit', 'Credit card'],
  ['Algèbre linéaire', 'Linear Algebra'],
  ['Théorie des médias', 'Media Theory'],
  ['Biologie', 'Biology'],
  ['Philosophie', 'Philosophy'],
  ['Systèmes de données', 'Data Systems'],
  ['Feuille d\'exercices', 'Problem set'],
  ['Dissertation', 'Essay'],
  ['Rapport de labo', 'Lab report'],
  ['Fiche de lecture', 'Reading response'],
  ['Présentation de groupe', 'Group presentation'],
  ['Partiel', 'Midterm'],
  ['Fin du semestre', 'Semester ends'],
  ['Vacances de printemps', 'Spring break'],

  // Legacy widget chrome that is injected dynamically
  ['Matin', 'Morning'],
  ['Soir', 'Evening'],
  ['Métrique', 'Metric'],
  ['+ Métrique', '+ Metric'],
  ['Aucune tâche', 'No tasks'],
  ['Aucune tâche.', 'No tasks.'],
  ['MOT DU JOUR', 'WORD OF THE DAY'],
  ['Mot du jour', 'Word of the day'],
  ['Plage de dates', 'Date range'],
  ['Risques', 'Risks'],
  ['Risque', 'Risk'],
  ['élevés', 'high'],
  ['élevé', 'high'],
  ['MARCHÉ', 'MARKET'],
  ['ÉNERGIE', 'ENERGY'],
  ['ENERGIE', 'ENERGY'],
  ['CYBER', 'CYBER'],
  ['CRÉDIT', 'CREDIT'],
  ['✏️ Éditer', '✏️ Edit'],
  ['Je l\'ai placé !', 'Got it!'],

  // Remaining chrome from the calendar, black-swan monitor and word widget
  ['+ Ère', '+ Era'],
  ['+ Étape', '+ Milestone'],
  ['Risques élevés', 'Elevated risks'],
  ['Risque élevé', 'Elevated risk'],
  ['Impact extrême', 'Extreme impact'],
  ['Impact élevé', 'High impact'],
  ['Marché', 'Market'],
  ['Énergie', 'Energy'],
  ['Crédit', 'Credit'],
  ['Démarrer session', 'Start session'],
  ['Ajouter carte', 'Add card'],
  ['Aucune tendance ajoutée', 'No trends yet'],
  ['Cliquez sur le bouton + pour ajouter la première tendance', 'Click + to add your first trend'],
  ['Nouvel événement', 'New event'],
  ['Événement', 'Event'],
  ['Probabilité', 'Probability'],
  ['Élevé', 'High'],
  ['Extrême', 'Extreme'],
  ['Systémique', 'Systemic'],
  ['Géopolitique', 'Geopolitical'],
  ['Catégorie', 'Category'],
  ['jour de suite', 'day streak'],
  ['Voir le vision board', 'Open vision board'],
  ['Jour précédent', 'Previous day'],
  ['Jour suivant', 'Next day'],
  ['Nouvelle métrique', 'New metric'],
  ['Ajouter une valeur', 'Add a value'],
  ['Unité', 'Unit'],
  ['Objectif', 'Target'],
  ['optionnel', 'optional'],
  ['Importer CSV', 'Import CSV'],
  ['Aucune carte à réviser', 'No cards to review'],
  ['Manière d\'être particulière à chaque individu, qui le distingue des autres.',
    'A peculiar way of being that sets each person apart.'],
  ['« Ses idiosyncrasies font partie de ce qui le rend si attachant. »',
    '“Her idiosyncrasies are part of what makes her so endearing.”'],
  ['Widget de départ — prêt pour vos données.', 'Starter widget — ready for your data.'],
  ['Widget de liste de tâches avec ajout, suppression et marquage comme terminé', 'Task list widget with add, delete and mark-as-done'],
  ['Modifiez les fichiers ou demandez à OpenCode de le construire.', 'Edit the files or ask OpenCode to build it.'],

  // OpenCode side panel (widget editor)
  ['Que veux-tu créer ?', 'What do you want to build?'],
  ['Décris ce que tu veux et OpenCode s\'en charge.', 'Describe what you want and OpenCode handles the rest.'],
  ['Décris ce que tu veux créer ou modifier...', 'Describe what you want to create or change...'],
  ['Décris ce que tu veux modifier sur le dashboard...', 'Describe what you want to change on the dashboard...'],
  ['Demande à OpenCode de modifier le script...', 'Ask OpenCode to change the script...'],
  ['Graphique', 'Chart'],
  ['Tableau', 'Table'],
  ['Autre...', 'Other...'],
  ['queue vide', 'queue empty'],
  ['file d\'attente vide', 'queue empty'],
  ['↵ Envoyer · ⇧↵ Retour à la ligne', '↵ Send · ⇧↵ New line'],
  ['Effacer', 'Clear'],
  ['Nouvelle session', 'New session'],
  ['Supprimer la session', 'Delete session'],
  ['Usage session', 'Session usage'],
  ['Usage semaine', 'Weekly usage'],
  ['Rafraîchir usage', 'Refresh usage'],
  ['Joindre un fichier', 'Attach a file'],
  ['Envoyer (Entrée)', 'Send (Enter)'],
  ['Prompts en attente', 'Pending prompts'],
  ['Vider la queue', 'Clear queue'],
  ['Effacer l\'historique', 'Clear history'],
  ['Copier l\'ID du widget', 'Copy widget ID'],
  ['ma_table', 'my_table'],
];

const toEnglish = new Map();
const toFrench = new Map();
for (const [fr, en] of PAIRS) {
  if (fr && en && fr !== en) {
    toEnglish.set(fr, en);
    toFrench.set(en, fr);
  }
}

const nodeOriginal = new WeakMap();
const attrOriginal = new WeakMap();
const observedDocs = new WeakSet();
const docObservers = new WeakMap();

let currentLang = 'en';
let initialized = false;

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

const FR_DAYS = {
  lundi: 'Monday', mardi: 'Tuesday', mercredi: 'Wednesday', jeudi: 'Thursday',
  vendredi: 'Friday', samedi: 'Saturday', dimanche: 'Sunday',
};
const FR_MONTHS = {
  janvier: 'January', février: 'February', fevrier: 'February', mars: 'March',
  avril: 'April', mai: 'May', juin: 'June', juillet: 'July', août: 'August',
  aout: 'August', septembre: 'September', octobre: 'October',
  novembre: 'November', décembre: 'December', decembre: 'December',
};
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function englishDate(day, month, year) {
  const index = Number(month) - 1;
  if (!EN_MONTHS[index]) return null;
  return `${EN_MONTHS[index]} ${Number(day)}, ${year}`;
}

/** Translate generated strings (dates, counters) that cannot live in the map. */
function dynamicEnglish(key) {
  let match = key.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+(\d{4}))?$/i);
  if (match) {
    const day = FR_DAYS[match[1].toLowerCase()];
    const month = FR_MONTHS[match[3].toLowerCase()];
    if (day && month) return `${day}, ${month} ${match[2]}${match[4] ? `, ${match[4]}` : ''}`;
  }

  // Era ranges: "Janvier 2018–Décembre 2021"
  match = key.match(/^(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\s*[–—-]\s*(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})$/i);
  if (match) {
    const start = FR_MONTHS[match[1].toLowerCase()];
    const end = FR_MONTHS[match[3].toLowerCase()];
    if (start && end) return `${start} ${match[2]} – ${end} ${match[4]}`;
  }

  match = key.match(/^(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})$/i);
  if (match) {
    const month = FR_MONTHS[match[1].toLowerCase()];
    if (month) return `${month} ${match[2]}`;
  }

  match = key.match(/^(\d+)\s*\/\s*(\d+)\s*tâches?$/i);
  if (match) return `${match[1]} / ${match[2]} tasks`;

  match = key.match(/^(\d+)\s*tâches?$/i);
  if (match) return `${match[1]} ${match[1] === '1' ? 'task' : 'tasks'}`;

  match = key.match(/^(\d+)\s+lignes?$/i);
  if (match) return `${match[1]} ${match[1] === '1' ? 'row' : 'rows'}`;

  match = key.match(/^(\d+)\s+colonnes?$/i);
  if (match) return `${match[1]} ${match[1] === '1' ? 'column' : 'columns'}`;

  match = key.match(/^(\d+)\s+tables?\s+assignées?$/i);
  if (match) return `${match[1]} ${match[1] === '1' ? 'table' : 'tables'} assigned`;

  match = key.match(/^(\d+)\s+lignes?\s+au\s+total$/i);
  if (match) return `${match[1]} ${match[1] === '1' ? 'row' : 'rows'} total`;

  match = key.match(/^(\d+)\s+fichier\(s\)$/i);
  if (match) return `${match[1]} file(s)`;

  match = key.match(/^(\d+)\s*\/\s*(\d+)\s*cartes?$/i);
  if (match) return `${match[1]} / ${match[2]} cards`;

  match = key.match(/^(\d+)\s+jours?\s+de\s+suite$/i);
  if (match) return `${match[1]} day${match[1] === '1' ? '' : 's'} streak`;

  match = key.match(/^(\d+)\s+cartes?\s+prêtes\s*!$/i);
  if (match) return `${match[1]} card${match[1] === '1' ? '' : 's'} ready!`;

  match = key.match(/^Temps\s*:\s*(\d+)\s*s$/i);
  if (match) return `Time: ${match[1]}s`;

  match = key.match(/^Prochaine révision optimale dans\s+(.+)$/i);
  if (match) return `Next optimal review in ${match[1]}`;

  match = key.match(/^Créé\s*:\s*(.+)$/i);
  if (match) {
    let value = match[1];
    const date = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (date) value = englishDate(date[1], date[2], date[3]) || value;
    return `Created: ${value}`;
  }

  return null;
}

/** Accept translations that keep a leading emoji or icon. */
function splitIconPrefix(key) {
  const match = key.match(/^([^\p{L}\p{N}]+)(.+)$/u);
  if (!match) return null;
  return { prefix: match[1], rest: match[2] };
}

function translateKey(key) {
  const direct = currentLang === 'en' ? toEnglish.get(key) : toFrench.get(key);
  if (direct) return direct;
  const dynamic = currentLang === 'en' ? dynamicEnglish(key) : null;
  if (dynamic) return dynamic;
  const parts = splitIconPrefix(key);
  if (!parts) return null;
  const inner = currentLang === 'en'
    ? (toEnglish.get(parts.rest) || dynamicEnglish(parts.rest))
    : toFrench.get(parts.rest);
  return inner ? `${parts.prefix}${inner}` : null;
}

function lookup(text) {
  const key = normalize(text);
  if (!key) return null;
  return translateKey(key);
}

function parentIsSkipped(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el || !el.closest) return false;
  if (el.closest('[data-i18n-skip]')) return true;
  const tag = el.tagName;
  return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'PRE' || tag === 'NOSCRIPT';
}

function whitespaceWrap(original, replacement) {
  const leading = (original.match(/^\s*/) || [''])[0];
  const trailing = (original.match(/\s*$/) || [''])[0];
  return `${leading}${replacement}${trailing}`;
}

function translateTextNode(node) {
  if (!node || !node.parentElement || parentIsSkipped(node)) return;
  const current = node.nodeValue;
  if (current == null) return;

  if (!nodeOriginal.has(node)) nodeOriginal.set(node, current);
  let original = nodeOriginal.get(node);

  const expected = lookup(original);
  if (expected == null) {
    // The app may have replaced the text. Treat the new value as the source.
    if (current !== original) {
      nodeOriginal.set(node, current);
      original = current;
    }
    const late = lookup(original);
    if (late == null) return;
    if (current !== whitespaceWrap(original, late)) node.nodeValue = whitespaceWrap(original, late);
    return;
  }

  // Detect text replaced by the app while the translation is active.
  const translated = whitespaceWrap(original, expected);
  if (current !== translated && current !== original) {
    nodeOriginal.set(node, current);
    original = current;
    const late = lookup(original);
    if (late == null) return;
    const lateText = whitespaceWrap(original, late);
    if (current !== lateText) node.nodeValue = lateText;
    return;
  }

  if (current !== translated) node.nodeValue = translated;
}

function translateElementAttrs(el) {
  if (!el || !el.getAttribute) return;
  if (el.closest && el.closest('[data-i18n-skip]')) return;
  let store = attrOriginal.get(el);
  if (!store) {
    store = {};
    attrOriginal.set(el, store);
  }
  for (const attr of ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    if (!(attr in store)) store[attr] = el.getAttribute(attr);
    const original = store[attr];
    if (original == null) continue;
    const translated = lookup(original);
    if (translated) {
      if (el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
    } else if (el.getAttribute(attr) !== original) {
      el.setAttribute(attr, original);
    }
  }
}

function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) {
    if (root.closest && root.closest('[data-i18n-skip]')) return;
    // Textareas/code blocks keep their text untranslated, but their
    // placeholder/title attributes still belong to the UI.
    translateElementAttrs(root);
    const tag = root.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'PRE' || tag === 'NOSCRIPT') return;
  }
  const children = root.childNodes;
  if (!children) return;
  for (let i = 0; i < children.length; i++) walk(children[i]);
}

function observeDocument(doc) {
  if (!doc || !doc.documentElement || observedDocs.has(doc)) return;
  observedDocs.add(doc);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        translateTextNode(mutation.target);
      } else if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => walk(node));
      } else if (mutation.type === 'attributes' && mutation.attributeName) {
        translateElementAttrs(mutation.target);
      }
    }
  });
  observer.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
  docObservers.set(doc, observer);
}

function translateIframe(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc || !doc.body) return;
    doc.documentElement.lang = currentLang;
    walk(doc.body);
    observeDocument(doc);
  } catch {
    // Cross-origin iframe (none in the dashboard, but stay safe).
  }
}

export function translateAllIframes() {
  document.querySelectorAll('iframe').forEach(translateIframe);
}

function updateToggle() {
  const button = document.getElementById('langToggleBtn');
  if (!button) return;
  const label = button.querySelector('.lang-toggle-label');
  if (label) label.textContent = currentLang.toUpperCase();
  button.dataset.lang = currentLang;
  button.title = currentLang === 'en' ? 'Switch to French' : 'Passer en anglais';
  button.setAttribute('aria-label', button.title);
}

export function getLang() {
  return currentLang;
}

export function setLang(lang, { persist = true } = {}) {
  currentLang = lang === 'fr' ? 'fr' : 'en';
  document.documentElement.lang = currentLang;
  if (persist) localStorage.setItem(STORAGE_KEY, currentLang);
  walk(document.body);
  observeDocument(document);
  translateAllIframes();
  updateToggle();
  window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: currentLang } }));
}

export function toggleLang() {
  setLang(currentLang === 'en' ? 'fr' : 'en');
}

export function translateDom(root = document.body) {
  walk(root);
}

export function initI18n() {
  if (initialized) return currentLang;
  initialized = true;

  const stored = localStorage.getItem(STORAGE_KEY);
  const browserLang = (navigator.language || 'en').toLowerCase();
  currentLang = stored === 'fr' || stored === 'en' ? stored : browserLang.startsWith('fr') ? 'fr' : 'en';
  document.documentElement.lang = currentLang;

  const button = document.getElementById('langToggleBtn');
  if (button) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      toggleLang();
    });
  }

  walk(document.body);
  observeDocument(document);

  // iframes load after the shell; translate them as soon as they are ready.
  document.addEventListener('load', (event) => {
    if (event.target && event.target.tagName === 'IFRAME') translateIframe(event.target);
  }, true);

  // New iframes are picked up by the body observer; also rescan on tab changes.
  window.addEventListener('dashboard:rendered', () => translateAllIframes());

  updateToggle();
  return currentLang;
}

// Public helper for inline scripts / older modules.
window.i18n = {
  getLang,
  setLang,
  toggle: toggleLang,
  translateDom,
  translateAllIframes,
};
