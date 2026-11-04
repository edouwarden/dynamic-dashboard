// Script backend — Fonctions disponibles :
// queryDB({ table, action, where?, data?, limit? })
// log(message, level?)  — 'info' | 'warn' | 'error'
// fetch(url, options?)  — HTTP natif
// sendWebhook(url, data) — POST JSON raccourci
// widget — { id, name }
// trigger — 'cron' | 'manual' | 'webhook' | 'widget-load'
// webhookPayload — données du webhook entrant

log('Script exécuté via ' + trigger);
