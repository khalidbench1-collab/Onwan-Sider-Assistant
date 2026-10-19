var STYLE_MAX_CHARS = 12000;

/**
 * Returns the journalist's Style Profile (tone rules, avoid-list, exemplar passages) as text
 * they pasted into settings. Style-sensitive actions degrade gracefully to no style guidance
 * when it is empty.
 *
 * This used to open a second Google Doc by URL, which forced the broad auth/documents scope
 * across the whole add-on. Reading stored text keeps Onwan inside documents.currentonly, so
 * OAuth verification only ever covers the document the journalist has open. No cache is needed:
 * the value is already a local user property.
 */
function getStyleProfile() {
  var text = PropertiesService.getUserProperties().getProperty(PROP_STYLE_TEXT);
  return text ? String(text).slice(0, STYLE_MAX_CHARS) : '';
}
