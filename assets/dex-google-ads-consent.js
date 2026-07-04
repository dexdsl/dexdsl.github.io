// Dex Google Ads Consent Mode v2 (_COOKIELESS_)
//
// Purpose: Google Ads page-view conversion tracking with privacy-minimal
// first-party consent mode.
//
// Flow:
// 1. Initialize Consent Mode with default-denied state before Google tag loads.
// 2. Store consent preference in localStorage under 'dex_consent_v1'.
// 3. On first visit, show consent banner.
// 4. On Accept: configure gtag with ad_storage/analytics_storage/ad_user_data=granted.
// 5. On Reject: keep all measurement denied.
// 6. On Settings/Change: update consent and apply to Google Ads.
//
// AD_ID = AW-16524541059
// CONVERSION_PATH = AW-16524541059/l8OqCNal6qQZEIP5wcc9

(function () {
  'use strict';

  // Configuration
  var AD_ID = 'AW-16524541059';
  var CONVERSION_PATH = 'AW-16524541059/l8OqCNal6qQZEIP5wcc9';
  var STORAGE_KEY = 'dex_consent_v1';
  var BANNER_CLASS = 'dex-consent-banner';
  var SETTINGS_MODAL_CLASS = 'dex-consent-modal';

  // Check if already initialized
  if (window.__DEX_CONSENT_ACTIVE__) return;
  window.__DEX_CONSENT_ACTIVE__ = true;

  // State
  var consentState = {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  };

  // 1. Load Consent Mode v2 defaults
  // Must run before gtag('config', AD_ID)
  function initConsentDefaults() {
    try {
      window.gtag = window.gtag || function () {
        (window.dataLayer = window.dataLayer || []).push(arguments);
      };

      gtag('consent', 'default', {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        functionality_storage: 'granted',
        security_storage: 'granted',
        wait_for_update: 500
      });
    } catch (e) {
      console.warn('[dex-google-ads-consent] Consent mode init failed:', e);
    }
  }

  // 2. Save consent to localStorage
  function saveConsent() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consentState));
    } catch (e) {
      console.warn('[dex-google-ads-consent] Cannot save consent:', e);
    }
  }

  // 3. Load stored consent from localStorage
  function loadConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        return saved;
      }
    } catch (e) {
      // Parse error -> no valid stored consent
    }
    return null;
  }

  // 4. Update Google Ads config with current consent state
  function updateGoogleAdsConfig() {
    try {
      gtag('config', AD_ID, {
        consent: consentState
      });
    } catch (e) {
      console.warn('[dex-google-ads-consent] Config failed, will retry on consent update:', e);
    }
  }

  // 5. Fire page-view conversion event
  function fireConversion() {
    try {
      gtag('event', 'conversion', {
        send_to: CONVERSION_PATH
      });
    } catch (e) {
      console.warn('[dex-google-ads-consent] Conversion event failed:', e);
    }
  }

  // 6. Update consent and re-configure Ads
  function applyConsent() {
    saveConsent();
    updateGoogleAdsConfig();

    // Re-fire conversion to respect new consent
    fireConversion();
  }

  // 7. Accept optional measurement consent
  function acceptOptional() {
    consentState.ad_storage = 'granted';
    consentState.analytics_storage = 'granted';
    consentState.ad_user_data = 'granted';
    // ad_personalization remains denied as per requirements
    applyConsent();

    hideBanner();
  }

  // 8. Reject optional measurement consent
  function rejectOptional() {
    consentState.ad_storage = 'denied';
    consentState.analytics_storage = 'denied';
    consentState.ad_user_data = 'denied';
    consentState.ad_personalization = 'denied';
    applyConsent();

    hideBanner();
  }

  // 9. Show/band settings modal
  function toggleSettings() {
    var modal = document.querySelector('.' + SETTINGS_MODAL_CLASS);
    if (modal) {
      modal.hidden = !modal.hidden;
      if (modal.hidden) {
        saveConsent(); // Auto-save when closing
      }
    }
  }

  // 10. Hide consent banner after acceptance
  function hideBanner() {
    var banner = document.querySelector('.' + BANNER_CLASS);
    if (banner) {
      banner.hidden = true;
    }
  }

  // 11. Initialize Consent Mode and load Google tag
  function init() {
    initConsentDefaults();

    // Load Google Ads tag (deferred to avoid blocking render)
    var gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + AD_ID;
    document.head.appendChild(gtagScript);

    // Configure after tag loads
    gtagScript.onload = function () {
      try {
        // Configure Google Ads with current consent
        updateGoogleAdsConfig();
        // Fire page-view conversion (respects consent mode)
        fireConversion();
      } catch (e) {
        console.warn('[dex-google-ads-consent] Google Ads config initial failed:', e);
      }
    };
  }

  // 12. Build and render consent banner UI
  function renderBanner() {
    if (document.querySelector('.' + BANNER_CLASS)) return;

    var banner = document.createElement('div');
    banner.className = BANNER_CLASS;
    banner.id = 'dex-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.tabIndex = -1;

    banner.innerHTML = [
      '<p id="dex-consent-text">We use Google Ads to measure how visitors interact with our site. Choose your consent below.</p>',
      '<div id="dex-consent-actions">',
      '  <button id="dex-consent-reject" class="dex-btn dex-btn-secondary" type="button">Reject optional</button>',
      '  <button id="dex-consent-accept" class="dex-btn dex-btn-primary" type="button">Accept optional</button>',
      '  <button id="dex-consent-settings" class="dex-btn dex-btn-tertiary" type="button" aria-expanded="false" aria-controls="dex-consent-settings-panel">',
      '    Cookie settings',
      '  </button>',
      '</div>'
    ].join('\n');

    // Insert after hero or above footer (detect first static section)
    var insertTarget = document.body.querySelector('.dex-overview, .dex-entry-header, .dex-collections, #main') ||
                       document.body.querySelector('.hero, header') ||
                       document.body;

    insertTarget.insertBefore(banner, insertTarget.firstChild);

    // Add inline styles
    var style = document.createElement('style');
    style.textContent = [
      '.dex-consent-banner {',
      '  position: fixed;',
      '  top: 0; left: 0; right: 0;',
      '  z-index: 9999;',
      '  padding: 16px;',
      '  background: #fff;',
      '  border-bottom: 1px solid rgba(0,0,0,0.1);',
      '  box-shadow: 0 2px 8px rgba(0,0,0,0.05);',
      '  animation: dexConsentBannerSlide 0.3s ease-out;',
      '  max-width: 1200px;',
      '  margin: 0 auto;',
      '}',
      '@keyframes dexConsentBannerSlide {',
      '  from { transform: translateY(-100%); }',
      '  to { transform: translateY(0); }',
      '}',
      '#dex-consent-text {',
      '  margin: 0 0 12px;',
      '  font-size: 0.9rem;',
      '  line-height: 1.4;',
      '  color: #333;',
      '}',
      '#dex-consent-actions {',
      '  display: flex;',
      '  gap: 8px;',
      '  flex-wrap: wrap;',
      '}',
      '.dex-consent-banner button {',
      '  padding: 8px 16px;',
      '  font-size: 0.85rem;',
      '  border-radius: 4px;',
      '  cursor: pointer;',
      '  border: 1px solid rgba(0,0,0,0.1);',
      '  transition: all 0.15s ease;',
      '  background: #fff;',
      '  color: #333;',
      '}',
      '.dex-consent-banner button:hover {',
      '  background: rgba(0,0,0,0.05);',
      '}',
      '.dex-consent-banner button:focus {',
      '  outline: 2px solid rgba(255, 25, 16, 0.4);',
      '  outline-offset: 2px;',
      '}',
      '.dex-consent-banner button:disabled {',
      '  opacity: 0.5;',
      '  cursor: not-allowed;',
      '}',
      '.dex-btn-primary {',
      '  background: linear-gradient(130deg, #ff1910, #ff9810);',
      '  color: #fff;',
      '  border: none;',
      '}',
      '.dex-btn-primary:hover {',
      '  background: linear-gradient(130deg, #ff2a1a, #ffa820);',
      '}',
      '.dex-btn-secondary {',
      '  background: transparent;',
      '  color: #333;',
      '}',
      '.dex-btn-secondary:hover {',
      '  background: rgba(0,0,0,0.05);',
      '}',
      '.dex-btn-tertiary {',
      '  background: transparent;',
      '  color: #666;',
      '}',
      '.dex-btn-tertiary:hover {',
      '  background: rgba(0,0,0,0.05);',
      '}',
      '@media (max-width: 640px) {',
      '  #dex-consent-actions {',
      '    flex-direction: column;',
      '  }',
      '  .dex-consent-banner {',
      '    padding: 12px;',
      '  }',
      '  .dex-consent-banner button {',
      '    width: 100%;',
      '  }',
      '}',
      '/* Keyboard accessibility */',
      '.dex-consent-banner button {',
      '  min-width: 80px;',
      '  text-align: center;',
      '}',
      '.dex-consent-banner button:focus-visible {',
      '  outline: 2px solid rgba(255, 25, 16, 0.6);',
      '  outline-offset: 2px;',
      '}',
      '// Reduce banner visibility for already-consented users',
      '.dex-consent-banner[aria-hidden="true"] {',
      '  display: none;',
      '}'
    ].join('\n');

    document.head.appendChild(style);

    // Bind events
    document.getElementById('dex-consent-reject').addEventListener('click', rejectOptional);
    document.getElementById('dex-consent-accept').addEventListener('click', acceptOptional);
    document.getElementById('dex-consent-settings').addEventListener('click', function (e) {
      var btn = e.currentTarget;
      var panel = document.querySelector('#dex-consent-settings-panel');
      if (!panel) return;
      
      var hidden = panel.hidden !== false;
      panel.hidden = hidden;
      btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    });
  }

  // 13. Render settings modal
  function renderSettingsModal() {
    if (document.querySelector('.' + SETTINGS_MODAL_CLASS)) return;

    var modal = document.createElement('div');
    modal.className = SETTINGS_MODAL_CLASS;
    modal.id = 'dex-consent-modal';
    modal.hidden = true; // Hidden by default

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'dex-consent-modal-title');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = [
      '<div class="dex-consent-modal-backdrop" role="presentation"></div>',
      '<div class="dex-consent-modal-content">',
      '  <h2 id="dex-consent-modal-title">Cookie settings</h2>',
      '  <p class="dex-consent-modal-desc">',
      '    We use cookies for advertising purposes. Choose your consent preferences.',
      '  </p>',
      '  <form id="dex-consent-form">',
      '    <div class="dex-consent-checkbox-item">',
      '      <input id="dex-consent-analyze" type="checkbox" value="true" disabled>',
      '      <label for="dex-consent-analyze">Analytics cookies</label>',
      '      <span class="dex-consent-checkbox-rem">Required for site functionality</span>',
      '    </div>',
      '    <div class="dex-consent-checkbox-item">',
      '      <input id="dex-consent-ad" type="checkbox" value="true" disabled>',
      '      <label for="dex-consent-ad">Advertising cookies</label>',
      '      <span class="dex-consent-checkbox-rem">Required for site functionality</span>',
      '    </div>',
      '    <div class="dex-consent-checkbox-item">',
      '      <input id="dex-consent-data" type="checkbox" value="true" disabled>',
      '      <label for="dex-consent-data">Personalized ads (ad_user_data)</label>',
      '      <span class="dex-consent-checkbox-rem">Opt-out for personalization</span>',
      '    </div>',
      '    <div class="dex-consent-actions">',
      '      <button class="dex-btn dex-btn-secondary" type="button" data-action="save">Save settings</button>',
      '      <button class="dex-btn dex-btn-primary" type="button" aria-label="Close modal">Got it</button>',
      '    </div>',
      '  </form>',
      '  <button class="dex-consent-modal-close" type="button" aria-label="Close modal">✕</button>',
      '</div>'
    ].join('\n');

    document.body.appendChild(modal);

    // Add modal styles (escaped to avoid JS comment parsing)
    var style = document.createElement('style');
    style.textContent = [
      '.dex-consent-modal {',
      '  position: fixed; inset: 0;',
      '  z-index: 10000;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  padding: 24px;',
      '  font-family: inherit;',
      '}',
      '.dex-consent-modal-backdrop {',
      '  position: absolute; inset: 0;',
      '  background: rgba(0,0,0,0.4);',
      '  cursor: pointer;',
      '}',
      '.dex-consent-modal-content {',
      '  position: relative;',
      '  background: #fff;',
      '  border-radius: 8px;',
      '  padding: 24px;',
      '  max-width: 440px;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.12);',
      '  z-index: 1;',
      '  animation: dexConsentModalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);',
      '}',
      '@keyframes dexConsentModalPop {',
      '  from { transform: scale(0.9); opacity: 0; }',
      '  to { transform: scale(1); opacity: 1; }',
      '}',
      '#dex-consent-modal-title {',
      '  margin: 0 0 8px;',
      '  font-size: 1.25rem;',
      '  font-weight: 600;',
      '  color: #333;',
      '}',
      '.dex-consent-modal-desc {',
      '  margin: 0 0 16px;',
      '  font-size: 0.95rem;',
      '  line-height: 1.5;',
      '  color: #666;',
      '}',
      '#dex-consent-form {',
      '  margin: 0;',
      '}',
      '.dex-consent-checkbox-item {',
      '  display: flex;',
      '  align-items: center;',
      '  padding: 12px 0;',
      '  border-bottom: 1px solid rgba(5,5,5,0.1);',
      '}',
      '.dex-consent-checkbox-item:last-child {',
      '  border-bottom: none;',
      '}',
      '.dex-consent-checkbox-item input[type="checkbox"] {',
      '  margin-right: 12px;',
      '  width: 18px;',
      '  height: 18px;',
      '  cursor: pointer;',
      '}',
      '.dex-consent-checkbox-item label {',
      '  flex: 1;',
      '  font-size: 0.9rem;',
      '  cursor: pointer;',
      '  transition: color 0.15s ease;',
      '}',
      '.dex-consent-checkbox-item:hover label {',
      '  color: #ff1910;',
      '}',
      '.dex-consent-checkbox-rem {',
      '  display: block;',
      '  font-size: 0.8rem;',
      '  color: #666;',
      '  margin-top: 2px;',
      '}',
      '.dex-consent-actions {',
      '  display: flex;',
      '  gap: 8px;',
      '  margin-top: 20px;',
      '  flex-wrap: wrap;',
      '}',
      '.dex-consent-actions button {',
      '  flex: 1;',
      '  padding: 10px 16px;',
      '  font-size: 0.9rem;',
      '  border-radius: 4px;',
      '  cursor: pointer;',
      '  white-space: nowrap;',
      '}',
      '.dex-consent-modal-close {',
      '  position: absolute; top: 12px; right: 12px;',
      '  background: none;',
      '  border: none;',
      '  font-size: 1.5rem;',
      '  cursor: pointer;',
      '  color: #666;',
      '  padding: 4px;',
      '  transition: color 0.15s ease;',
      '}',
      '.dex-consent-modal-close:hover {',
      '  color: #ff1910;',
      '}',
      'input[disabled=disabled] + label {',
      '  opacity: 0.5;',
      '  cursor: not-allowed;',
      '}',
      '.dex-btn-secondary {',
      '  background: rgba(255,255,255,0.05);',
      '}',
      '.dex-btn-primary {',
      '  background: linear-gradient(130deg, #ff1910, #ff9810);',
      '  color: #fff;',
      '  border: none;',
      '}',
      '.dex-btn-secondary:hover {',
      '  background: rgba(255,255,255,0.1);',
      '}',
      '.dex-btn-primary:hover {',
      '  background: linear-gradient(130deg, #ff2a1a, #ffa820);',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 4px 12px rgba(255, 25, 16, 0.3);',
      '}',
      '.dex-consent-modal-close {',
      '  padding: 4px 8px;',
      '}',
      '.dex-consent-modal:focus {',
      '  outline: none;',
      '}',
      '.dex-consent-modal:focus-visible {',
      '  outline: 2px solid rgba(255, 25, 16, 0.6);',
      '  outline-offset: 4px;',
      '}',
      '@media (hover: hover) and (pointer: fine) {',
      '  .dex-btn-secondary:hover {',
      '    background: rgba(255,255,255,0.1);',
      '  }',
      '  .dex-btn-primary:hover {',
      '    background: linear-gradient(130deg, #ff2a1a, #ffa820);',
      '  }',
      '}',
      '.dex-consent-modal.hidden {',
      '  display: none;',
      '}'
    ].join('\n');

    document.head.appendChild(style);

    // Bind events
    modal.querySelector('[data-action="save"]').addEventListener('click', toggleSettings);
    modal.querySelector('.dex-consent-modal-close').addEventListener('click', toggleSettings);
    modal.querySelector('.dex-consent-modal-backdrop').addEventListener('click', toggleSettings);

    // Close on Escape
    modal.addEventListener('click', function (e) {
      if (e.target === modal) toggleSettings();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) toggleSettings();
    });
  }

  // 14. Main entry point
  function main() {
    var stored = loadConsent();

    if (stored) {
      // Restore consent state for returning visitors
      consentState = stored;
      hideBanner();
    } else {
      // First visit -> show banner
      // Small delay to prevent flashing before DOM is ready
      setTimeout(function () {
        renderBanner();
        renderSettingsModal();
      }, 100);
    }

    // Initialize Google Ads
    init();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();