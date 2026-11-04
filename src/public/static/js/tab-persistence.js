// Script d'injection pour la persistence automatique des tabs
// Ce script est injecté dans chaque iframe de tab

(function() {
  'use strict';

  // Débounce pour éviter trop de sauvegardes
  let saveTimeout = null;
  const DEBOUNCE_DELAY = 500; // 500ms

  // Récupérer l'ID du tab depuis l'URL
  function getTabId() {
    const pathParts = window.location.pathname.split('/');
    const tabIndex = pathParts.indexOf('tabs');
    return tabIndex !== -1 ? pathParts[tabIndex + 1] : null;
  }

  const TAB_ID = getTabId();
  if (!TAB_ID) {
    console.warn('[TabPersistence] Unable to determine tab ID');
    return;
  }

  // Collecter l'état actuel du tab
  function collectState() {
    // 1. LocalStorage
    const localStorageData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      localStorageData[key] = localStorage.getItem(key);
    }

    // 2. Données de formulaires
    const formData = {};
    document.querySelectorAll('input, textarea, select').forEach(element => {
      if (element.name || element.id) {
        const key = element.name || element.id;

        if (element.type === 'checkbox') {
          formData[key] = element.checked;
        } else if (element.type === 'radio') {
          if (element.checked) {
            formData[key] = element.value;
          }
        } else {
          formData[key] = element.value;
        }
      }
    });

    // 3. Position de scroll
    const scrollPosition = {
      x: window.scrollX || window.pageXOffset,
      y: window.scrollY || window.pageYOffset,
    };

    return {
      localStorage: localStorageData,
      formData,
      scrollPosition,
    };
  }

  // Envoyer l'état au parent
  function saveState() {
    const state = collectState();

    // Envoyer au parent via postMessage
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'tab-state-update',
        tabId: TAB_ID,
        state: state,
      }, '*');
    }
  }

  // Sauvegarder avec debounce
  function debouncedSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(saveState, DEBOUNCE_DELAY);
  }

  // Restaurer l'état depuis le serveur
  async function restoreState() {
    try {
      const response = await fetch(`/api/tabs/${TAB_ID}/state`);
      if (!response.ok) return;

      const savedState = await response.json();

      // 1. Restaurer localStorage
      if (savedState.localStorage) {
        Object.keys(savedState.localStorage).forEach(key => {
          localStorage.setItem(key, savedState.localStorage[key]);
        });
      }

      // 2. Restaurer les formulaires
      if (savedState.formData) {
        Object.keys(savedState.formData).forEach(key => {
          const element = document.querySelector(`[name="${key}"], #${key}`);
          if (element) {
            if (element.type === 'checkbox') {
              element.checked = savedState.formData[key];
            } else if (element.type === 'radio') {
              if (element.value === savedState.formData[key]) {
                element.checked = true;
              }
            } else {
              element.value = savedState.formData[key];
            }
          }
        });
      }

      // 3. Restaurer le scroll
      if (savedState.scrollPosition) {
        window.scrollTo(savedState.scrollPosition.x, savedState.scrollPosition.y);
      }

      console.log('[TabPersistence] State restored for tab', TAB_ID);
    } catch (err) {
      console.warn('[TabPersistence] Failed to restore state:', err);
    }
  }

  // Intercepter les modifications de localStorage
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalClear = localStorage.clear;

  localStorage.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    debouncedSave();
  };

  localStorage.removeItem = function(key) {
    originalRemoveItem.call(this, key);
    debouncedSave();
  };

  localStorage.clear = function() {
    originalClear.call(this);
    debouncedSave();
  };

  // Écouter les changements de formulaires
  document.addEventListener('input', debouncedSave, true);
  document.addEventListener('change', debouncedSave, true);

  // Écouter le scroll
  window.addEventListener('scroll', debouncedSave, { passive: true });

  // Restaurer au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreState);
  } else {
    restoreState();
  }

  // Sauvegarder avant de quitter
  window.addEventListener('beforeunload', saveState);

  console.log('[TabPersistence] Initialized for tab', TAB_ID);
})();
