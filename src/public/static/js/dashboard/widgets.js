/**
 * Dashboard widgets — point d'entrée
 * Importe les sous-modules (prototype augmentation Dashboard)
 *   instance-config  — config des valeurs par instance
 *   crud             — créer, éditer, supprimer, backups, galerie
 *   style            — thèmes, presets de style
 *   opencode-sessions — sessions OpenCode + historique
 *   permissions      — permissions DB, schémas, tables
 *   attachments      — pièces jointes Claude
 *   queue            — queue de prompts SSE + notifications polling
 *   proposals        — approval CREATE/ALTER TABLE
 *   settings         — paramètres globaux + suppression widget
 */
import './widgets/instance-config.js?v=331';
import './widgets/crud.js?v=331';
import './widgets/style.js?v=331';
import './widgets/opencode-sessions.js?v=331';
import './widgets/permissions.js?v=331';
import './widgets/attachments.js?v=331';
import './widgets/queue.js?v=331';
import './widgets/proposals.js?v=331';
import './widgets/settings.js?v=331';
