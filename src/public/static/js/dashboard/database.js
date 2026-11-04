/**
 * Dashboard database — point d'entrée
 *   backups          — sauvegardes d'onglets
 *   tables           — liste tables, permissions, proposals CREATE/ALTER
 *   permissions-quick — sélection rapide de table/permissions
 *   create-table     — column builder, createTable()
 *   explorer         — navigation data, pagination, édition lignes, ALTER TABLE
 */
import './database/backups.js?v=331';
import './database/tables.js?v=331';
import './database/permissions-quick.js?v=331';
import './database/create-table.js?v=331';
import './database/explorer.js?v=331';
