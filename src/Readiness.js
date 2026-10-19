// Which workflow role each document tab plays, derived from the tab titles in
// WORKSPACE_TEMPLATES. The tabs are created by hand (see proposalArchitectureMarkdown_),
// so titles are typed by the user and matched loosely rather than byte for byte.
function docRoleForTitle_(title) {
  var wanted = normalizeTabTitle_(title);
  if (!wanted) return '';
  var found = '';
  workspaceDefinitions_().forEach(function (definition) {
    if (found) return;
    if (
      normalizeTabTitle_(definition[1]) === wanted ||
      normalizeTabTitle_(definition[2]) === wanted
    ) {
      found = definition[0];
    }
  });
  return found;
}

function workspaceDefinitions_() {
  var all = [];
  ['quick', 'investigation'].forEach(function (type) {
    var template = WORKSPACE_TEMPLATES[type];
    all = all.concat(template.roots, template.children);
  });
  return all;
}

function normalizeTabTitle_(title) {
  return String(title == null ? '' : title)
    .replace(/\u0640/g, '')
    .replace(/[\u064b-\u0652]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// How far along a piece of text is: nothing, a bare topic, or something that reads like a
// worked proposal. getProposalWizardContext and the sidebar gate both call this, so the
// wizard and the button states can never disagree about the same document.
var PROPOSAL_SIGNALS = [
  /(?:زاوية|angle|hypoth[eè]se|فرضية)/i,
  /(?:أسئلة|questions?|questions? cl[eé]s)/i,
  /(?:لماذا الآن|why now|pourquoi maintenant)/i,
  /(?:مسودة العرض|pitch|proposition)/i,
  /(?:أدلة|evidence|preuves?)/i,
  /(?:تحقيق|investigation|enqu[eê]te)/i,
];

function proposalSignalStrength_(text) {
  var trimmed = String(text == null ? '' : text).trim();
  if (!trimmed) return 'blank';
  var words = trimmed.split(/\s+/).length;
  var signals = PROPOSAL_SIGNALS.filter(function (pattern) {
    return pattern.test(trimmed);
  }).length;
  if (words >= 80 || (words >= 40 && signals >= 2)) return 'proposal';
  return 'topic';
}

// Roles that answer "is there a proposal / a draft yet". A tab counts only if its own text
// backs the claim: an empty Proposal tab beside a long Draft tab is still no proposal.
var PROPOSAL_TAB_ROLES = ['proposal', 'approvedProposal'];
var DRAFT_TAB_ROLES = ['draft', 'finalStory'];
var DRAFT_MIN_WORDS = 80;

function readinessFromTabs_(tabs) {
  tabs = tabs || [];
  var roles = {};
  var anyText = false;
  var wholeText = [];
  tabs.forEach(function (tab) {
    var text = String((tab && tab.text) || '');
    if (text.trim()) anyText = true;
    wholeText.push(text);
    var role = docRoleForTitle_(tab && tab.title);
    if (role) roles[role] = (roles[role] || '') + '\n' + text;
  });

  var proposalText = firstRoleText_(roles, PROPOSAL_TAB_ROLES);
  var draftText = firstRoleText_(roles, DRAFT_TAB_ROLES);
  var combined = wholeText.join('\n');

  return {
    tabsPresent: Object.keys(roles).length > 0,
    hasText: anyText,
    // With no recognised tabs — the common case, since the suggested structure is created
    // by hand — judge the document as a whole rather than reporting nothing is ready.
    hasProposal: proposalSignalStrength_(
      proposalText === null ? combined : proposalText
    ) === 'proposal',
    hasDraft: wordCount_(draftText === null ? combined : draftText) >= DRAFT_MIN_WORDS,
  };
}

function firstRoleText_(roles, wanted) {
  for (var i = 0; i < wanted.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(roles, wanted[i])) return roles[wanted[i]];
  }
  return null;
}

function wordCount_(text) {
  var trimmed = String(text == null ? '' : text).trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Whether one action is ready to run against the current document state. Actions with no
// prerequisite — the proposal entry points — are always ready, so a new user always has
// something they are allowed to click.
function gateForAction_(actionId, state) {
  var rule = ACTION_PREREQUISITES[actionId];
  if (!rule) return { ready: true, requires: '', unblockedBy: '' };
  return {
    ready: !!(state && state[rule.requires]),
    requires: rule.requires,
    unblockedBy: rule.unblockedBy,
  };
}

var READINESS_SCAN_CHARS = 4000;
var DOC_STATE_CACHE_KEY = 'ONWAN_DOC_STATE';
var DOC_STATE_CACHE_SECONDS = 60;

// The readiness of the current document, for the sidebar to explain its buttons with.
// Costs no credits and makes no backend call: everything here is read locally.
function getDocState() {
  try {
    var cache = CacheService.getUserCache();
    var cached = cache.get(DOC_STATE_CACHE_KEY);
    if (cached) return { ok: true, data: JSON.parse(cached) };
    var state = readinessFromTabs_(readDocumentTabs_());
    state.activeTabRole = docRoleForTitle_(activeTabTitle_());
    cache.put(DOC_STATE_CACHE_KEY, JSON.stringify(state), DOC_STATE_CACHE_SECONDS);
    return { ok: true, data: state };
  } catch (err) {
    return { ok: true, data: permissiveDocState_() };
  }
}

function docStateClear_() {
  try {
    CacheService.getUserCache().remove(DOC_STATE_CACHE_KEY);
  } catch (e) {}
}

// Reached through the active document, like bodyForTabId_, to stay inside
// documents.currentonly. Only the first READINESS_SCAN_CHARS of each tab are read: the
// question is what kind of material a tab holds, which its opening is enough to answer.
function readDocumentTabs_() {
  var doc = DocumentApp.getActiveDocument();
  var collected = [];
  var roots = typeof doc.getTabs === 'function' ? doc.getTabs() : null;
  if (!roots || !roots.length) {
    return [{ title: activeTabTitle_(), text: scanText_(activeBody_()) }];
  }
  collectTabs_(roots, collected);
  return collected;
}

function collectTabs_(tabs, collected) {
  (tabs || []).forEach(function (tab) {
    try {
      collected.push({
        title: tab.getTitle(),
        text: scanText_(tab.asDocumentTab().getBody()),
      });
    } catch (e) {}
    try {
      if (typeof tab.getChildTabs === 'function') {
        collectTabs_(tab.getChildTabs(), collected);
      }
    } catch (e) {}
  });
}

function scanText_(body) {
  return String(body.getText() || '').substring(0, READINESS_SCAN_CHARS);
}

// A hint, not an authorisation check. When the scan fails, every step opens and the
// server-side EMPTY and NEED_PROPOSAL checks remain as the real guard.
function permissiveDocState_() {
  return {
    tabsPresent: false,
    hasText: true,
    hasProposal: true,
    hasDraft: true,
    activeTabRole: '',
  };
}

// The one step most worth doing next. Journalism runs proposal -> reporting -> draft ->
// verification, so the earliest unmet prerequisite is the honest recommendation.
function nextStepFor_(state) {
  state = state || {};
  if (!state.hasProposal) return 'proposal';
  if (!state.hasDraft) return 'storyFramework';
  return 'claimCheck';
}

// Everything the sidebar needs to explain itself, in one call: the readiness of the
// document, a verdict per action, and the step to suggest. No credits, no backend call.
function getDocGates() {
  var state = getDocState().data;
  var gates = {};
  Object.keys(ACTION_DEFS).forEach(function (actionId) {
    gates[actionId] = gateForAction_(actionId, state);
  });
  return {
    ok: true,
    data: { state: state, gates: gates, nextStep: nextStepFor_(state) },
  };
}
