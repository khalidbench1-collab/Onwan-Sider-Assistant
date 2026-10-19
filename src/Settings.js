var PROP_STYLE_TEXT = 'STYLE_PROFILE_TEXT';
var PROP_BACKEND_URL = 'ONWAN_BACKEND_URL';

function getBackendUrl_() {
  return String(
    PropertiesService.getScriptProperties().getProperty(PROP_BACKEND_URL) || ''
  ).replace(/\/+$/, '');
}

function getSettings() {
  var languageState = getProjectLanguageState_();
  return {
    uiLocale: getUiLocale_(),
    projectLanguage:
      languageState.source === 'manual' ? languageState.language : 'auto',
    detectedProjectLanguage:
      languageState.source === 'auto' ? languageState.language : '',
    projectLanguageSource: languageState.source,
    styleText:
      PropertiesService.getUserProperties().getProperty(PROP_STYLE_TEXT) || '',
    backendConfigured: !!getBackendUrl_(),
  };
}

function saveSettings(settings) {
  var props = PropertiesService.getUserProperties();
  if (settings.styleText !== undefined)
    props.setProperty(PROP_STYLE_TEXT, String(settings.styleText).trim().slice(0, STYLE_MAX_CHARS));
  if (settings.uiLocale !== undefined) setUiLocale_(settings.uiLocale);
  if (settings.projectLanguage !== undefined)
    setProjectLanguageOverride_(settings.projectLanguage);
  return getSettings();
}

function testConnection() {
  try {
    var res = backendHealth_();
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, error: humanError(err) };
  }
}

function devTestConnection() {
  Logger.log(JSON.stringify(testConnection()));
}
