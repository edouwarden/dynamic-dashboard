// Types principaux du dashboard

// Nouveau système de widgets
export interface TabStyle {
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
  colorText: string;
  fontFamily: string;
  borderRadius: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  borderWidth: string;
  shadowStyle: 'none' | 'light' | 'medium' | 'heavy';
}

export interface GridConfig {
  cols: number;
  rowHeight: number;
  gap: number;
}

export interface TabPage {
  id: string;
  name: string;
  emoji?: string;
  order: number;
  widgets: WidgetInstance[];
  gridConfig: GridConfig;
}

export interface TabVariable {
  key: string;
  value: any;
  updatedAt: string;
}

export interface WidgetInstance {
  id: string; // Instance unique dans la tab
  widgetId: string; // Référence au widget dans /widgets/
  position: { x: number; y: number; cols: number; rows: number };
  config: Record<string, any>;
}

export interface WidgetConfigField {
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  default?: any;
  options?: string[];  // pour type 'select'
  description?: string;
}

export interface Widget {
  id: string;
  name: string;
  emoji?: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  dbPermissions?: DbPermission[];
  autoApproveCreateTable?: boolean;
  autoApproveAlterTable?: boolean;
  configSchema?: Record<string, WidgetConfigField>;
  category?: string; // Catégorie pour l'organisation dans la galerie
  canSendGlobalNotifications?: boolean; // Autoriser les notifications globales
  canSendTabNotifications?: boolean; // Autoriser les notifications par onglet
}

export interface WidgetConfig {
  widget: Widget;
  version: number;
}

// Tab simplifié (plus de content/, plus de dbPermissions au niveau tab)
export interface Tab {
  id: string;
  name: string;
  emoji?: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  style?: TabStyle;
  widgets?: WidgetInstance[];       // Rétrocompat — widgets de la page par défaut
  gridConfig?: GridConfig;          // Rétrocompat — gridConfig de la page par défaut
  pages?: TabPage[];                // Pages multiples (si défini, prioritaire sur widgets/gridConfig)
  currentPageId?: string;           // Dernière page active
  variables?: Record<string, any>; // Variables partagées entre widgets de l'onglet
}

export interface TabConfig {
  tab: Tab;
  version: number;
}

export interface DashboardConfig {
  tabs: Tab[];
  webPort: number;
  createdAt: string;
  updatedAt: string;
}

export interface Backup {
  id: string;
  widgetId?: string; // Pour les backups de widgets
  tabId?: string; // Pour les backups legacy (à supprimer éventuellement)
  timestamp: string;
  description?: string;
  autoName?: string; // Nom automatique généré (ex: "Modification de index.html")
  screenshot?: string; // Base64 de la capture d'écran
  files: string[];
  filesChanged?: string[]; // Fichiers modifiés depuis le dernier backup
  source?: 'manual' | 'auto-opencode' | 'auto-restore';
}

export interface BackupManifest {
  backups: Backup[];
}

export interface OpenCodeContext {
  widgetId?: string;
  widgetName?: string;
  tabId?: string; // Legacy, pour rétrocompatibilité
  tabName?: string; // Legacy, pour rétrocompatibilité
  dbPermissions?: DbPermission[]; // Pour widgets uniquement
  instructions?: string;
}

export interface TabState {
  localStorage: Record<string, string>;
  formData: Record<string, any>;
  scrollPosition: { x: number; y: number };
  timestamp: number;
}

// Trigger pour scripts globaux
export interface ScriptTrigger {
  type: 'cron' | 'manual' | 'webhook';
  cron?: string;       // ex: "0 14 * * *"
  enabled: boolean;
}

export interface DbPermission {
  table: string;
  actions: ('select' | 'insert' | 'update' | 'delete')[];
  columns?: string[];
  maxRows?: number;
}

export interface QueryRequest {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  columns?: string[];
  where?: Record<string, any>;
  data?: Record<string, any>;
  limit?: number;
  orderBy?: string;
}

// Script global (standalone, sans widget parent)
export interface GlobalScript {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
  triggers: ScriptTrigger[];
  dbPermissions: DbPermission[];
  autoApproveCreateTable?: boolean;
  autoApproveAlterTable?: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'error';
}

export interface GlobalScriptManifest {
  script: GlobalScript;
  version: number;
}
