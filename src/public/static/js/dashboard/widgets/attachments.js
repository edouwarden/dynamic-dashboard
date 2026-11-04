/**
 * Dashboard widgets — upload de fichiers pour OpenCode
 * Le rendu des pièces jointes est géré par OpenCodePanel
 * Reste ici : uploadAttachments() appelé via onUploadFiles callback
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // Upload les fichiers vers le serveur et retourne [{ name, path, type }]
  // Appelé par OpenCodePanel via opts.onUploadFiles
  async uploadAttachments(widgetId, files) {
    if (!widgetId || !files?.length) return [];
    const results = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res  = await fetch(`/api/widgets/${widgetId}/opencode/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          results.push({ name: file.name, path: data.absolutePath, type: file.type });
        }
      } catch (err) {
        console.error('[Upload] Erreur:', err);
      }
    }
    return results;
  },
});
