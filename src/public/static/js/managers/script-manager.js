/**
 * GlobalScriptManager — point d'entrée
 * Importe les sous-modules (prototype augmentation) et ré-exporte la classe
 */
import './script-manager/catalog.js?v=331';
import './script-manager/timeline-scheduler.js?v=331';
import './script-manager/editor.js?v=331';
import './script-manager/triggers.js?v=331';
import './script-manager/chat.js?v=331';
import './script-manager/admin.js?v=331';
import './script-manager/actions.js?v=331';

export { GlobalScriptManager } from './script-manager/core.js?v=331';
