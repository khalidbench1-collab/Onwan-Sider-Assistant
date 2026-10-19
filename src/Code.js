var ADDON_TITLE = 'Onwan / عنوان';

// onOpen runs in AuthMode.NONE for a published add-on the user has installed but not yet used in
// the current document. That mode forbids PropertiesService and every other service that reads
// user data; any such call throws, which aborts menu construction and leaves only "Help".
// This function therefore contains nothing but getUi(), createAddonMenu(), addItem() and
// addToUi(), and the label is a static bilingual string rather than a stored locale preference.
// The sidebar picks up the user's language once it opens in AuthMode.FULL.
// Do not add service calls, property reads, or ScriptApp references here.
function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('Open Onwan / فتح عنوان', 'showSidebar')
    .addToUi();
}

// Runs in AuthMode.FULL when the add-on is installed from the Marketplace. The document is
// already open by then, so onOpen has not fired for it — populate the menu here too.
function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle(ADDON_TITLE);
  DocumentApp.getUi().showSidebar(html);
}

function showExpandedOnwan() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setWidth(720)
    .setHeight(760);
  DocumentApp.getUi().showModelessDialog(html, ADDON_TITLE);
}
