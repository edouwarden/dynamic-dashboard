/**
 * GlobalScriptManager — configuration des triggers
 * renderTriggers, cron parse/build/describe, activateSubtab
 * Méthodes : renderTriggers, _parseCronMode, _buildCronFromUI, _describeCron,
 *   _updateCronPreview, _onCronModeChange, getTriggersFromUI, activateSubtab
 * Méthodes ajoutées au prototype GlobalScriptManager
 */
import { GlobalScriptManager } from './core.js?v=331';

Object.assign(GlobalScriptManager.prototype, {
  renderTriggers(triggers) {
    const container = document.getElementById('globalScriptTriggersContainer');
    if (!container) return;

    const cronTrigger = triggers.find(t => t.type === 'cron') || { type: 'cron', cron: '0 * * * *', enabled: false };
    const manualTrigger = triggers.find(t => t.type === 'manual') || { type: 'manual', enabled: true };
    const webhookTrigger = triggers.find(t => t.type === 'webhook') || { type: 'webhook', enabled: false };

    const p = this._parseCronMode(cronTrigger.cron || '0 * * * *');
    const timeDaily = `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    const timeWeekly = timeDaily;
    const days = [{d:1,l:'L'},{d:2,l:'M'},{d:3,l:'Me'},{d:4,l:'J'},{d:5,l:'V'},{d:6,l:'S'},{d:0,l:'D'}];

    container.innerHTML = `
      <div class="script-trigger-item">
        <label class="wt-toggle-option" style="margin:0;padding:6px 0;border:none;font-size:12px;">
          <input type="checkbox" id="gsTriggerManual" ${manualTrigger.enabled ? 'checked' : ''}> Manuel
        </label>
      </div>
      <div class="script-trigger-item">
        <label class="wt-toggle-option" style="margin:0;padding:6px 0;border:none;font-size:12px;">
          <input type="checkbox" id="gsTriggerCron" ${cronTrigger.enabled ? 'checked' : ''}
            onchange="document.getElementById('gsCronBuilder').style.display=this.checked?'':'none'"> Planifié
        </label>
        <div class="cron-builder" id="gsCronBuilder" style="${cronTrigger.enabled ? '' : 'display:none'}">
          <select id="gsCronMode" onchange="dashboard.globalScriptManager._onCronModeChange()">
            <option value="minutes" ${p.mode==='minutes'?'selected':''}>Toutes les X minutes</option>
            <option value="hours" ${p.mode==='hours'?'selected':''}>Toutes les X heures</option>
            <option value="daily" ${p.mode==='daily'?'selected':''}>Tous les jours à…</option>
            <option value="weekly" ${p.mode==='weekly'?'selected':''}>Certains jours à…</option>
            <option value="custom" ${p.mode==='custom'?'selected':''}>Expression cron</option>
          </select>
          <div class="cron-option" id="gsCronOptMinutes" style="${p.mode==='minutes'?'':'display:none'}">
            Toutes les <input type="number" id="gsCronMinVal" min="1" max="59" value="${p.value||5}"
              oninput="dashboard.globalScriptManager._updateCronPreview()"> minutes
          </div>
          <div class="cron-option" id="gsCronOptHours" style="${p.mode==='hours'?'':'display:none'}">
            Toutes les <input type="number" id="gsCronHourVal" min="1" max="23" value="${p.value||1}"
              oninput="dashboard.globalScriptManager._updateCronPreview()"> heures
          </div>
          <div class="cron-option" id="gsCronOptDaily" style="${p.mode==='daily'?'':'display:none'}">
            Tous les jours à <input type="time" id="gsCronDailyTime" value="${timeDaily}"
              onchange="dashboard.globalScriptManager._updateCronPreview()">
          </div>
          <div class="cron-option" id="gsCronOptWeekly" style="${p.mode==='weekly'?'':'display:none'}">
            <div class="cron-days">
              ${days.map(({d,l})=>`<button type="button" class="cron-day-btn${(p.days||[]).includes(d)?' active':''}" data-day="${d}"
                onclick="this.classList.toggle('active');dashboard.globalScriptManager._updateCronPreview()">${l}</button>`).join('')}
            </div>
            <span>à</span>
            <input type="time" id="gsCronWeeklyTime" value="${timeWeekly}"
              onchange="dashboard.globalScriptManager._updateCronPreview()">
          </div>
          <div class="cron-option" id="gsCronOptCustom" style="${p.mode==='custom'?'':'display:none'}">
            <div style="width:100%">
              <input type="text" class="cron-raw-input" id="gsCronExpr" value="${cronTrigger.cron||'0 * * * *'}"
                oninput="dashboard.globalScriptManager._updateCronPreview()" placeholder="min heure jour mois jour-sem">
              <div class="cron-help">minute heure jour mois jour-semaine</div>
            </div>
          </div>
          <div class="cron-preview" id="gsCronPreview"></div>
        </div>
      </div>
      <div class="script-trigger-item">
        <label class="wt-toggle-option" style="margin:0;padding:6px 0;border:none;font-size:12px;">
          <input type="checkbox" id="gsTriggerWebhook" ${webhookTrigger.enabled ? 'checked' : ''}> Webhook
        </label>
        ${webhookTrigger.enabled ? `<div style="font-size:11px;color:var(--text-muted);font-family:monospace;margin-top:4px;word-break:break-all;">POST /api/scripts/webhook/${this.currentScript?.id}</div>` : ''}
      </div>
    `;
    this._updateCronPreview();
  },

  // Analyse un cron pour déterminer le mode UI
  _parseCronMode(cronExpr) {
    const parts = (cronExpr || '0 * * * *').trim().split(/\s+/);
    const base = { cron: cronExpr, hour: 8, minute: 0, value: 5, days: [] };
    if (parts.length !== 5) return { ...base, mode: 'custom' };

    const [min, hour, dom, month, dow] = parts;
    const m = parseInt(min), h = parseInt(hour);
    base.minute = isNaN(m) ? 0 : m;
    base.hour = isNaN(h) ? 0 : h;

    if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*')
      return { ...base, mode: 'minutes', value: parseInt(min.slice(2)) || 5 };
    if (min === '0' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*')
      return { ...base, mode: 'hours', value: parseInt(hour.slice(2)) || 1 };
    if (!isNaN(m) && !isNaN(h) && dom === '*' && month === '*' && dow === '*')
      return { ...base, mode: 'daily' };
    if (!isNaN(m) && !isNaN(h) && dom === '*' && month === '*' && dow !== '*')
      return { ...base, mode: 'weekly', days: dow.split(',').map(Number) };
    return { ...base, mode: 'custom' };
  },

  // Construit le cron à partir de l'UI
  _buildCronFromUI() {
    const mode = document.getElementById('gsCronMode')?.value || 'custom';
    switch (mode) {
      case 'minutes': {
        const v = parseInt(document.getElementById('gsCronMinVal')?.value) || 5;
        return `*/${v} * * * *`;
      }
      case 'hours': {
        const v = parseInt(document.getElementById('gsCronHourVal')?.value) || 1;
        return `0 */${v} * * *`;
      }
      case 'daily': {
        const [h, m] = (document.getElementById('gsCronDailyTime')?.value || '08:00').split(':').map(Number);
        return `${m} ${h} * * *`;
      }
      case 'weekly': {
        const [h, m] = (document.getElementById('gsCronWeeklyTime')?.value || '08:00').split(':').map(Number);
        const ds = [...document.querySelectorAll('.cron-day-btn.active')].map(b => b.dataset.day);
        return ds.length ? `${m} ${h} * * ${ds.join(',')}` : `${m} ${h} * * *`;
      }
      default:
        return document.getElementById('gsCronExpr')?.value?.trim() || '0 * * * *';
    }
  },

  // Décrit un cron en français
  _describeCron(cronExpr) {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return cronExpr;
    const [min, hour, , , dow] = parts;
    if (min.startsWith('*/') && hour === '*') return `Toutes les ${min.slice(2)} minutes`;
    if (min === '0' && hour.startsWith('*/')) return `Toutes les ${hour.slice(2)} heures`;
    const dayNames = {0:'dim',1:'lun',2:'mar',3:'mer',4:'jeu',5:'ven',6:'sam'};
    const hh = String(hour).padStart(2,'0'), mm = String(min).padStart(2,'0');
    if (!isNaN(min) && !isNaN(hour) && dow === '*') return `Tous les jours à ${hh}:${mm}`;
    if (!isNaN(min) && !isNaN(hour) && dow !== '*') {
      const ds = dow.split(',').map(d => dayNames[d] || d).join(', ');
      return `${ds} à ${hh}:${mm}`;
    }
    return cronExpr;
  },

  _updateCronPreview() {
    const el = document.getElementById('gsCronPreview');
    if (!el) return;
    const expr = this._buildCronFromUI();
    el.textContent = '⏰ ' + this._describeCron(expr);
  },

  _onCronModeChange() {
    const mode = document.getElementById('gsCronMode')?.value;
    ['Minutes','Hours','Daily','Weekly','Custom'].forEach(m => {
      const el = document.getElementById('gsCronOpt' + m);
      if (el) el.style.display = m.toLowerCase() === mode ? '' : 'none';
    });
    this._updateCronPreview();
  },

  getTriggersFromUI() {
    const triggers = [];
    if (document.getElementById('gsTriggerManual')?.checked) {
      triggers.push({ type: 'manual', enabled: true });
    }
    const cronEnabled = document.getElementById('gsTriggerCron')?.checked;
    const cronExpr = this._buildCronFromUI();
    triggers.push({ type: 'cron', enabled: cronEnabled || false, cron: cronExpr });
    if (document.getElementById('gsTriggerWebhook')?.checked) {
      triggers.push({ type: 'webhook', enabled: true });
    }
    return triggers;
  },

  activateSubtab(name) {
    document.querySelectorAll('#globalScriptSubtabs .script-subtab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === name);
    });
    document.querySelectorAll('#scriptEditorView .script-subtab-content').forEach(content => {
      content.style.display = content.dataset.subtab === name ? 'flex' : 'none';
      if (content.dataset.subtab === name) content.classList.add('active');
      else content.classList.remove('active');
    });
  },
});
