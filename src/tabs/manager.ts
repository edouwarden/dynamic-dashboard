/**
 * TabManager simplifié - Plus de content/, plus de Claude au niveau tab
 * Les tabs sont maintenant juste des conteneurs de widgets
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdir, readdir, readFile, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config';
import type { Tab, TabConfig, TabStyle, GridConfig, WidgetInstance, TabPage } from '../types';

export class TabManager {
  private configFile: string;

  constructor() {
    this.configFile = join(CONFIG.TABS_DIR, 'tabs-index.json');
  }

  async init(): Promise<void> {
    await mkdir(CONFIG.TABS_DIR, { recursive: true });
  }

  /**
   * Lister tous les tabs
   */
  async getTabs(): Promise<Tab[]> {
    try {
      const dirs = await readdir(CONFIG.TABS_DIR);

      // Lire tous les tab.json en parallèle
      const results = await Promise.all(
        dirs.map(async (dir) => {
          const tabJsonPath = join(CONFIG.TABS_DIR, dir, 'tab.json');
          if (!existsSync(tabJsonPath)) return null;
          try {
            const content = await readFile(tabJsonPath, 'utf-8');
            const tabConfig: TabConfig = JSON.parse(content);
            return tabConfig.tab;
          } catch {
            return null;
          }
        })
      );

      return results.filter((t): t is Tab => t !== null).sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Erreur lors du listage des tabs:', error);
      return [];
    }
  }

  /**
   * Récupérer un tab
   */
  async getTab(id: string): Promise<Tab | null> {
    try {
      const tabJsonPath = join(CONFIG.TABS_DIR, id, 'tab.json');
      if (!existsSync(tabJsonPath)) return null;

      const content = await readFile(tabJsonPath, 'utf-8');
      const tabConfig: TabConfig = JSON.parse(content);
      return tabConfig.tab;
    } catch (error) {
      console.error(`Erreur lors de la récupération du tab ${id}:`, error);
      return null;
    }
  }

  /**
   * Créer un nouveau tab
   */
  async createTab(name: string, emoji?: string): Promise<Tab> {
    const id = uuidv4();
    const tabDir = join(CONFIG.TABS_DIR, id);

    await mkdir(tabDir, { recursive: true });

    const now = new Date().toISOString();
    const tabs = await this.getTabs();

    const tab: Tab = {
      id,
      name,
      emoji: emoji || '📄',
      createdAt: now,
      updatedAt: now,
      order: tabs.length,
      style: {
        colorPrimary: '#60a5fa',
        colorSecondary: '#a78bfa',
        colorBackground: '#111827',
        colorText: '#f3f4f6',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '8px',
        borderStyle: 'solid',
        borderWidth: '1px',
        shadowStyle: 'medium'
      },
      widgets: [],
      gridConfig: {
        cols: 24,
        rowHeight: 40,
        gap: 12
      }
    };

    const tabConfig: TabConfig = {
      tab,
      version: 1
    };

    await writeFile(join(tabDir, 'tab.json'), JSON.stringify(tabConfig, null, 2));

    console.log(`✅ Tab créé: ${id} (${name})`);
    return tab;
  }

  /**
   * Mettre à jour un tab (nom, emoji, ordre)
   */
  async updateTab(id: string, updates: Partial<Pick<Tab, 'name' | 'emoji' | 'order'>>): Promise<Tab | null> {
    const tab = await this.getTab(id);
    if (!tab) return null;

    if (updates.name !== undefined) tab.name = updates.name;
    if (updates.emoji !== undefined) tab.emoji = updates.emoji;
    if (updates.order !== undefined) tab.order = updates.order;
    tab.updatedAt = new Date().toISOString();

    await this.saveTab(tab);
    return tab;
  }

  /**
   * Supprimer un tab
   */
  async deleteTab(id: string): Promise<void> {
    const tabDir = join(CONFIG.TABS_DIR, id);
    if (existsSync(tabDir)) {
      await rm(tabDir, { recursive: true, force: true });
      console.log(`✅ Tab supprimé: ${id}`);
    }
  }

  /**
   * Ajouter un widget à une tab
   */
  async addWidgetToTab(
    tabId: string,
    widgetId: string,
    position?: { x: number; y: number; cols: number; rows: number },
    config?: Record<string, any>
  ): Promise<WidgetInstance> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    const instanceId = uuidv4();

    const instance: WidgetInstance = {
      id: instanceId,
      widgetId,
      position: position || { x: 0, y: 0, cols: 12, rows: 8 },
      config: config || {}
    };

    if (!tab.widgets) tab.widgets = [];
    tab.widgets.push(instance);

    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Widget ${widgetId} ajouté à la tab ${tabId}`);
    return instance;
  }

  /**
   * Retirer un widget d'une tab
   */
  async removeWidgetFromTab(tabId: string, instanceId: string): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    if (!tab.widgets) tab.widgets = [];
    tab.widgets = tab.widgets.filter(w => w.id !== instanceId);

    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Widget instance ${instanceId} retiré de la tab ${tabId}`);
  }

  /**
   * Retirer un widget de tous les onglets (par widgetId)
   */
  async removeWidgetFromAllTabs(widgetId: string): Promise<void> {
    const tabs = await this.getTabs();
    for (const tab of tabs) {
      let modified = false;
      // Retirer des pages si le tab a des pages
      if (tab.pages) {
        for (const page of tab.pages) {
          if (page.widgets.some(w => w.widgetId === widgetId)) {
            page.widgets = page.widgets.filter(w => w.widgetId !== widgetId);
            modified = true;
          }
        }
      }
      // Retirer du root (rétrocompat)
      if (tab.widgets?.some(w => w.widgetId === widgetId)) {
        tab.widgets = tab.widgets.filter(w => w.widgetId !== widgetId);
        modified = true;
      }
      if (modified) {
        await this.saveTab(tab);
        console.log(`✅ Widget ${widgetId} retiré de la tab ${tab.id}`);
      }
    }
  }

  /**
   * Trouver une instance de widget dans le tab (pages + root)
   */
  private findWidgetInstance(tab: Tab, instanceId: string): WidgetInstance | null {
    // Chercher dans les pages d'abord
    if (tab.pages) {
      for (const page of tab.pages) {
        const w = page.widgets.find(w => w.id === instanceId);
        if (w) return w;
      }
    }
    // Fallback sur le root (rétrocompat sans pages)
    return tab.widgets?.find(w => w.id === instanceId) || null;
  }

  /**
   * Synchroniser tab.widgets avec la page courante (rétrocompat)
   */
  private syncRootWidgets(tab: Tab): void {
    if (tab.pages && tab.currentPageId) {
      const page = tab.pages.find(p => p.id === tab.currentPageId);
      if (page) tab.widgets = page.widgets;
    }
  }

  /**
   * Mettre à jour la position d'un widget
   */
  async updateWidgetPosition(
    tabId: string,
    instanceId: string,
    position: { x: number; y: number; cols: number; rows: number }
  ): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    const widget = this.findWidgetInstance(tab, instanceId);
    if (!widget) throw new Error(`Widget instance ${instanceId} introuvable`);

    widget.position = position;
    this.syncRootWidgets(tab);
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);
  }

  /**
   * Mettre à jour la config d'un widget (fusion avec existant)
   * @param configSchema - schéma du widget pour ajouter les defaults manquants
   */
  async updateWidgetConfig(
    tabId: string,
    instanceId: string,
    config: Record<string, any>,
    configSchema?: Record<string, any>
  ): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    const widget = this.findWidgetInstance(tab, instanceId);
    if (!widget) throw new Error(`Widget instance ${instanceId} introuvable`);

    // Fusionner la nouvelle config avec l'existante (remplace les clés existantes, conserve le reste)
    const merged = { ...widget.config, ...config };

    // Ajouter les champs manquants du schema avec leurs defaults
    if (configSchema) {
      for (const [key, field] of Object.entries(configSchema)) {
        if (!(key in merged) && (field as any).default !== undefined) {
          merged[key] = (field as any).default;
        }
      }
    }

    widget.config = merged;
    this.syncRootWidgets(tab);
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);
  }

  /**
   * Mettre à jour le style d'une tab
   */
  async updateTabStyle(tabId: string, style: TabStyle): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    tab.style = style;
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Style de la tab ${tabId} mis à jour`);
  }

  /**
   * Définir une variable d'onglet (partagée entre widgets)
   */
  async setTabVariable(tabId: string, key: string, value: any): Promise<boolean> {
    const tab = await this.getTab(tabId);
    if (!tab) return false;

    if (!tab.variables) tab.variables = {};
    tab.variables[key] = value;
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Variable "${key}" définie pour la tab ${tabId}`);
    return true;
  }

  /**
   * Supprimer une variable d'onglet
   */
  async deleteTabVariable(tabId: string, key: string): Promise<boolean> {
    const tab = await this.getTab(tabId);
    if (!tab) return false;

    if (!tab.variables) return true;
    delete tab.variables[key];
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Variable "${key}" supprimée de la tab ${tabId}`);
    return true;
  }

  /**
   * Mettre à jour la configuration du grid d'une tab
   */
  async updateGridConfig(tabId: string, gridConfig: GridConfig, pageId?: string): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    if (pageId && tab.pages) {
      const page = tab.pages.find(p => p.id === pageId);
      if (!page) throw new Error(`Page ${pageId} introuvable`);
      page.gridConfig = gridConfig;
    } else {
      tab.gridConfig = gridConfig;
    }
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ GridConfig de la tab ${tabId} mis à jour`);
  }

  // === PAGES ===

  /**
   * Résoudre widgets/gridConfig selon la page (rétrocompat)
   */
  private resolvePage(tab: Tab, pageId?: string): { widgets: WidgetInstance[], gridConfig: GridConfig, page?: TabPage } {
    if (pageId && tab.pages) {
      const page = tab.pages.find(p => p.id === pageId);
      if (page) return { widgets: page.widgets, gridConfig: page.gridConfig, page };
    }
    return {
      widgets: tab.widgets || [],
      gridConfig: tab.gridConfig || { cols: 24, rowHeight: 40, gap: 12 }
    };
  }

  /**
   * Migrer un tab vers le système de pages (crée une page par défaut)
   */
  migrateToPages(tab: Tab): void {
    if (tab.pages && tab.pages.length > 0) return; // déjà migré
    const defaultPage: TabPage = {
      id: uuidv4(),
      name: 'Page 1',
      order: 0,
      widgets: tab.widgets || [],
      gridConfig: tab.gridConfig || { cols: 24, rowHeight: 40, gap: 12 }
    };
    tab.pages = [defaultPage];
    tab.currentPageId = defaultPage.id;
    // Garder widgets/gridConfig pour rétrocompat lecture
  }

  /**
   * Ajouter une page à un tab
   */
  async addPage(tabId: string, name: string, emoji?: string): Promise<TabPage> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    // Migrer si nécessaire
    this.migrateToPages(tab);

    const page: TabPage = {
      id: uuidv4(),
      name,
      emoji,
      order: tab.pages!.length,
      widgets: [],
      gridConfig: tab.gridConfig || { cols: 24, rowHeight: 40, gap: 12 }
    };

    tab.pages!.push(page);
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Page "${name}" ajoutée à la tab ${tabId}`);
    return page;
  }

  /**
   * Modifier une page
   */
  async updatePage(tabId: string, pageId: string, updates: Partial<Pick<TabPage, 'name' | 'emoji' | 'order'>>): Promise<TabPage | null> {
    const tab = await this.getTab(tabId);
    if (!tab || !tab.pages) return null;

    const page = tab.pages.find(p => p.id === pageId);
    if (!page) return null;

    if (updates.name !== undefined) page.name = updates.name;
    if (updates.emoji !== undefined) page.emoji = updates.emoji;
    if (updates.order !== undefined) page.order = updates.order;
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    return page;
  }

  /**
   * Supprimer une page
   */
  async deletePage(tabId: string, pageId: string): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab || !tab.pages) throw new Error(`Tab ${tabId} introuvable ou sans pages`);
    if (tab.pages.length <= 1) throw new Error('Impossible de supprimer la dernière page');

    tab.pages = tab.pages.filter(p => p.id !== pageId);
    // Réattribuer les ordres
    tab.pages.sort((a, b) => a.order - b.order);
    for (let i = 0; i < tab.pages.length; i++) tab.pages[i].order = i;

    // Si la page courante est supprimée, basculer sur la première
    if (tab.currentPageId === pageId) {
      tab.currentPageId = tab.pages[0].id;
    }

    // Synchroniser widgets/gridConfig du root avec la page courante
    const current = tab.pages.find(p => p.id === tab.currentPageId) || tab.pages[0];
    tab.widgets = current.widgets;
    tab.gridConfig = current.gridConfig;

    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Page ${pageId} supprimée de la tab ${tabId}`);
  }

  /**
   * Réordonner les pages
   */
  async reorderPages(tabId: string, pageIds: string[]): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab || !tab.pages) throw new Error(`Tab ${tabId} introuvable ou sans pages`);

    for (let i = 0; i < pageIds.length; i++) {
      const page = tab.pages.find(p => p.id === pageIds[i]);
      if (page) page.order = i;
    }
    tab.pages.sort((a, b) => a.order - b.order);
    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);
  }

  /**
   * Réordonner les tabs
   */
  async reorderTabs(tabIds: string[]): Promise<void> {
    const tabs = await this.getTabs();
    for (let i = 0; i < tabIds.length; i++) {
      const tab = tabs.find(t => t.id === tabIds[i]);
      if (tab) {
        tab.order = i;
        tab.updatedAt = new Date().toISOString();
        await this.saveTab(tab);
      }
    }
  }

  /**
   * Ajouter un widget à une page spécifique
   */
  async addWidgetToPage(
    tabId: string,
    pageId: string,
    widgetId: string,
    position?: { x: number; y: number; cols: number; rows: number },
    config?: Record<string, any>
  ): Promise<WidgetInstance> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    const page = tab.pages?.find(p => p.id === pageId);
    if (!page) throw new Error(`Page ${pageId} introuvable`);

    const instanceId = uuidv4();
    const instance: WidgetInstance = {
      id: instanceId,
      widgetId,
      position: position || { x: 0, y: 0, cols: 12, rows: 8 },
      config: config || {}
    };

    page.widgets.push(instance);

    // Synchroniser le root si c'est la page courante
    if (tab.currentPageId === pageId) {
      tab.widgets = page.widgets;
    }

    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Widget ${widgetId} ajouté à la page ${pageId} de la tab ${tabId}`);
    return instance;
  }

  /**
   * Retirer un widget d'une page spécifique
   */
  async removeWidgetFromPage(tabId: string, pageId: string, instanceId: string): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    const page = tab.pages?.find(p => p.id === pageId);
    if (!page) throw new Error(`Page ${pageId} introuvable`);

    page.widgets = page.widgets.filter(w => w.id !== instanceId);

    if (tab.currentPageId === pageId) {
      tab.widgets = page.widgets;
    }

    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);

    console.log(`✅ Widget instance ${instanceId} retiré de la page ${pageId}`);
  }

  /**
   * Mettre à jour la position d'un widget dans une page
   */
  async updateWidgetPositionInPage(
    tabId: string,
    pageId: string,
    instanceId: string,
    position: { x: number; y: number; cols: number; rows: number }
  ): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    const page = tab.pages?.find(p => p.id === pageId);
    if (!page) throw new Error(`Page ${pageId} introuvable`);

    const widget = page.widgets.find(w => w.id === instanceId);
    if (!widget) throw new Error(`Widget instance ${instanceId} introuvable`);

    widget.position = position;

    if (tab.currentPageId === pageId) {
      tab.widgets = page.widgets;
    }

    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);
  }

  /**
   * Sauvegarder la page courante
   */
  async setCurrentPage(tabId: string, pageId: string): Promise<void> {
    const tab = await this.getTab(tabId);
    if (!tab) throw new Error(`Tab ${tabId} introuvable`);

    tab.currentPageId = pageId;

    // Synchroniser root avec la page courante
    if (tab.pages) {
      const page = tab.pages.find(p => p.id === pageId);
      if (page) {
        tab.widgets = page.widgets;
        tab.gridConfig = page.gridConfig;
      }
    }

    tab.updatedAt = new Date().toISOString();
    await this.saveTab(tab);
  }

  /**
   * Récupérer le contenu HTML d'un tab
   */
  async getTabContent(id: string): Promise<string | null> {
    try {
      const indexPath = join(CONFIG.TABS_DIR, id, 'content', 'index.html');
      if (!existsSync(indexPath)) return null;
      return await readFile(indexPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Lister les fichiers d'un tab
   */
  async getTabFiles(id: string): Promise<string[]> {
    try {
      const contentDir = join(CONFIG.TABS_DIR, id, 'content');
      if (!existsSync(contentDir)) return [];
      const entries = await readdir(contentDir, { withFileTypes: true });
      return entries.filter(e => e.isFile()).map(e => e.name);
    } catch {
      return [];
    }
  }

  /**
   * Récupérer l'état sauvegardé d'un tab
   */
  async getTabState(id: string): Promise<Record<string, any> | null> {
    try {
      const statePath = join(CONFIG.TABS_DIR, id, 'state.json');
      if (!existsSync(statePath)) return null;
      const content = await readFile(statePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Sauvegarder l'état d'un tab
   */
  async saveTabState(id: string, state: Record<string, any>): Promise<void> {
    const statePath = join(CONFIG.TABS_DIR, id, 'state.json');
    await writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Sauvegarder un tab
   */
  private async saveTab(tab: Tab): Promise<void> {
    const tabDir = join(CONFIG.TABS_DIR, tab.id);
    const tabJsonPath = join(tabDir, 'tab.json');

    // Lire la version actuelle
    let version = 1;
    if (existsSync(tabJsonPath)) {
      const content = await readFile(tabJsonPath, 'utf-8');
      const tabConfig: TabConfig = JSON.parse(content);
      version = tabConfig.version + 1;
    }

    const tabConfig: TabConfig = {
      tab,
      version
    };

    await writeFile(tabJsonPath, JSON.stringify(tabConfig, null, 2));
  }
}

// Export singleton
export const tabManager = new TabManager();
