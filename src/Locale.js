var PROP_UI_LOCALE = 'ONWAN_UI_LOCALE';
var PROP_PROJECT_LANGUAGE = 'ONWAN_PROJECT_LANGUAGE';
var PROP_PROJECT_LANGUAGE_SOURCE = 'ONWAN_PROJECT_LANGUAGE_SOURCE';
var SUPPORTED_UI_LOCALES = { ar: true, en: true };

function getUiLocale_() {
  var value = PropertiesService.getUserProperties().getProperty(PROP_UI_LOCALE);
  return SUPPORTED_UI_LOCALES[value] ? value : '';
}

function setUiLocale_(locale) {
  locale = String(locale || '').toLowerCase();
  if (!SUPPORTED_UI_LOCALES[locale]) throw new AppError('BAD_LOCALE');
  PropertiesService.getUserProperties().setProperty(PROP_UI_LOCALE, locale);
  return locale;
}

function getProjectLanguageState_() {
  var props = PropertiesService.getDocumentProperties();
  return {
    language: props.getProperty(PROP_PROJECT_LANGUAGE) || 'auto',
    source: props.getProperty(PROP_PROJECT_LANGUAGE_SOURCE) || 'auto',
  };
}

function setProjectLanguageOverride_(language) {
  language = String(language || 'auto').toLowerCase().trim();
  if (!/^(auto|[a-z]{2,3}(?:-[a-z0-9]{2,8})?)$/.test(language))
    throw new AppError('BAD_LANGUAGE');
  var props = PropertiesService.getDocumentProperties();
  if (language === 'auto') {
    props.deleteProperty(PROP_PROJECT_LANGUAGE);
    props.setProperty(PROP_PROJECT_LANGUAGE_SOURCE, 'auto');
  } else {
    props.setProperty(PROP_PROJECT_LANGUAGE, language);
    props.setProperty(PROP_PROJECT_LANGUAGE_SOURCE, 'manual');
  }
  return getProjectLanguageState_();
}

function rememberDetectedProjectLanguage_(language) {
  language = String(language || '').toLowerCase();
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(language)) return;
  var props = PropertiesService.getDocumentProperties();
  if (props.getProperty(PROP_PROJECT_LANGUAGE_SOURCE) !== 'manual') {
    props.setProperty(PROP_PROJECT_LANGUAGE, language);
    props.setProperty(PROP_PROJECT_LANGUAGE_SOURCE, 'auto');
  }
}

function projectLanguageRequest_(text) {
  var state = getProjectLanguageState_();
  if (state.source === 'manual' && state.language !== 'auto') {
    return { outputLanguage: state.language, hint: state.language };
  }
  return { outputLanguage: 'auto', hint: detectScriptHint_(text) };
}

function detectScriptHint_(text) {
  text = String(text || '');
  if (!text.trim()) return getUiLocale_() || 'ar';
  var arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  var hebrew = (text.match(/[\u0590-\u05FF]/g) || []).length;
  var cyrillic = (text.match(/[\u0400-\u04FF]/g) || []).length;
  var latin = (text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  if (arabic > Math.max(hebrew, cyrillic, latin) * 0.35) return 'ar';
  if (hebrew > Math.max(arabic, cyrillic, latin) * 0.5) return 'he';
  if (cyrillic > Math.max(arabic, hebrew, latin) * 0.5) return 'auto';
  return latin ? 'auto' : getUiLocale_() || 'ar';
}

function isRtlLanguage_(language) {
  return /^(ar|fa|he|ur)(-|$)/i.test(String(language || ''));
}
