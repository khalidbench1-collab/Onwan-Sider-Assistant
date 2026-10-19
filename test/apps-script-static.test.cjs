const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const read = (name) => fs.readFileSync(path.join(src, name), 'utf8');
const allSource = fs
  .readdirSync(src)
  .filter((name) => /\.(js|html|json)$/.test(name))
  .map(read)
  .join('\n');

test('every Apps Script JavaScript file parses', () => {
  fs.readdirSync(src)
    .filter((name) => name.endsWith('.js'))
    .forEach((name) => {
      assert.doesNotThrow(() => new Function(read(name)), `${name} must parse`);
    });
});

test('the Apps Script client contains no provider key or Anthropic path', () => {
  assert.doesNotMatch(allSource, /anthropic|sk-ant|ANTHROPIC_API_KEY|getApiKey_/i);
  assert.equal(fs.existsSync(path.join(src, 'Claude.js')), false);
});

test('the manifest contains identity and document scopes', () => {
  const manifest = JSON.parse(read('appsscript.json'));
  const scopes = new Set(manifest.oauthScopes);
  assert(scopes.has('openid'));
  assert(scopes.has('https://www.googleapis.com/auth/userinfo.email'));
  assert(scopes.has('https://www.googleapis.com/auth/documents.currentonly'));
  assert(scopes.has('https://www.googleapis.com/auth/script.external_request'));
});

test('the add-on stays within the narrow current-document scope', () => {
  // documents.currentonly cannot open any other document, and cannot reopen the active one
  // by id either. A single openById call anywhere would force the broad, sensitive
  // auth/documents scope back into OAuth verification.
  const manifest = JSON.parse(read('appsscript.json'));
  assert.equal(manifest.oauthScopes.includes('https://www.googleapis.com/auth/documents'), false);
  // Match invocations, not prose: the code comments explain why openById is avoided.
  assert.doesNotMatch(allSource, /\.openById\s*\(|\.openByUrl\s*\(|\bDriveApp\s*\./);
  assert.match(read('DocService.js'), /getActiveDocument\(\)[\s\S]{0,120}getTab\(/);
});

test('the style profile is stored text, not a second document', () => {
  const settings = read('Settings.js');
  const style = read('StyleProfile.js');
  assert.match(settings, /PROP_STYLE_TEXT/);
  assert.doesNotMatch(settings, /STYLE_PROFILE_DOC_URL/);
  assert.doesNotMatch(style, /DocumentApp/);
});

test('all seven managed-Gemini action definitions are present', () => {
  const prompts = read('Prompts.js');
  [
    'proposalIdeas',
    'proposal',
    'research',
    'fieldworkPlan',
    'storyFramework',
    'editDraft',
    'claimCheck',
  ].forEach((action) => assert.match(prompts, new RegExp(`${action}:`)));
});

test('generated text is written directly and never rendered in a sidebar card', () => {
  const actions = read('Actions.js');
  const docs = read('DocService.js');
  const sidebar = read('Sidebar.html');
  assert.match(actions, /writeGeneratedResult_/);
  assert.match(actions, /pendingWritePut_/);
  assert.match(docs, /activeBody_/);
  assert.match(docs, /insertStructuredAt_/);
  assert.doesNotMatch(sidebar, /result-slot|renderCard|copyText|applyResult/);
});

test('proposal-dependent actions survive an evicted temporary proposal cache', () => {
  const actions = read('Actions.js');
  assert.match(actions, /var currentTarget = getTargetText\(\)/);
  assert.match(actions, /currentTarget\.text\.trim\(\)[\s\S]*lastProposalGet_\(\)/);
});

test('action feedback is brought into view and fieldwork has a location icon', () => {
  const sidebar = read('Sidebar.html');
  assert.match(sidebar, /function revealFeedback\(\)/);
  assert.match(sidebar, /main\.scrollTop = 0/);
  assert.match(
    sidebar,
    /runActionUi\('fieldworkPlan'\)[\s\S]*<span class="symbol">📍<\/span>/,
  );
});

test('the interface has bilingual branding and no legacy product name', () => {
  const sidebar = read('Sidebar.html');
  const code = read('Code.js');
  assert.match(sidebar, /var STRINGS =/);
  assert.match(sidebar, /عنوان/);
  assert.match(sidebar, /Onwan/);
  assert.match(code, /Onwan \/ عنوان/);
  assert.doesNotMatch(sidebar, /المحرّر/);
  assert.doesNotMatch(code, /المحرّر/);
});

test('proposal wizard previews three angles and writes a manual tab architecture', () => {
  const actions = read('Actions.js');
  const workspace = read('Workspace.js');
  const sidebar = read('Sidebar.html');
  assert.match(actions, /function getProposalWizardContext\(\)/);
  assert.match(actions, /function suggestProposalAngles\(payload\)/);
  assert.match(actions, /preview\.ideas\.length !== 3/);
  assert.match(sidebar, /function startProposalWizard\(\)/);
  assert.match(sidebar, /response\.data\.preview\.ideas/);
  assert.match(
    sidebar,
    /state\.proposal\.angles = response\.data\.preview\.ideas \|\| \[\];[\s\S]*state\.proposal\.selectedIndex = -1;/
  );
  assert.match(sidebar, /button\.onclick = function \(\) \{ selectAngle\(index\); \}/);
  assert.match(sidebar, /if \(!angle\)/);
  assert.match(
    sidebar,
    /if \(response\.data\.entitlement\)[\s\S]*renderEntitlement\(\);[\s\S]*hideStatus\(\);[\s\S]*state\.proposal\.angles/
  );
  assert.match(actions, /proposalArchitectureMarkdown_/);
  assert.match(workspace, /function proposalArchitectureMarkdown_/);
  assert.match(workspace, /Recommended document tabs/);
  assert.match(workspace, /بنية التبويبات المقترحة/);
  assert.doesNotMatch(workspace, /addDocumentTab/);
  assert.doesNotMatch(workspace, /updateDocumentTabProperties/);
  assert.match(workspace, /approvedProposal/);
  assert.match(workspace, /proposalRole: 'proposal'/);
  assert.match(actions, /lastProposalPut_\(writeState\.proposalMarkdown\)/);
  assert.doesNotMatch(actions, /ensureProposalWorkspace_/);
});

test('the free-limit message offers a route without promising access', () => {
  const errors = read('Errors.js');
  const ar = errors.slice(errors.indexOf('ar: {'), errors.indexOf('en: {'));
  const en = errors.slice(errors.indexOf('en: {'));
  assert.match(ar, /FREE_LIMIT:[^\n]*support@onwan\.eu[^\n]*قد يتوفر المزيد/);
  assert.match(en, /FREE_LIMIT:[^\n]*support@onwan\.eu[^\n]*more may be available/);
  assert.doesNotMatch(errors, /free software/i);
});

test('every interface string exists in both locales', () => {
  const sidebar = read('Sidebar.html');
  const body = sidebar.slice(sidebar.indexOf('var STRINGS ='));
  // Brace-match the locale block. Slicing on the next label instead would leave the
  // label itself inside the slice (capturing 'ar' as a key), and the last locale would
  // run to end-of-file and swallow unrelated object literals from the rest of the script.
  const blockOf = (label) => {
    const open = body.indexOf('{', body.indexOf(label + ': {'));
    let depth = 0;
    for (let i = open; i < body.length; i += 1) {
      if (body[i] === '{') depth += 1;
      else if (body[i] === '}') {
        depth -= 1;
        if (depth === 0) return body.slice(open + 1, i);
      }
    }
    throw new Error('unterminated ' + label + ' block');
  };
  const keysOf = (block) => {
    const found = new Set();
    const pattern = /(?:^|[{,])\s*([A-Za-z][A-Za-z0-9_]*)\s*:/g;
    let match;
    while ((match = pattern.exec(block)) !== null) found.add(match[1]);
    return found;
  };
  const arKeys = keysOf(blockOf('ar'));
  const enKeys = keysOf(blockOf('en'));
  const missingEn = [...arKeys].filter((key) => !enKeys.has(key));
  const missingAr = [...enKeys].filter((key) => !arKeys.has(key));
  assert.deepEqual(missingEn, [], `missing from en: ${missingEn.join(', ')}`);
  assert.deepEqual(missingAr, [], `missing from ar: ${missingAr.join(', ')}`);
  assert.ok(arKeys.has('tagline'), 'extraction must reach the first key of a block');
  assert.ok(arKeys.size > 40, `expected a populated dictionary, found ${arKeys.size} keys`);
});

test('the sidebar offers a route when the free allowance runs out', () => {
  const sidebar = read('Sidebar.html');
  assert.match(sidebar, /id="cap-panel"/);
  assert.match(sidebar, /capTitle:/);
  assert.match(sidebar, /capBody:/);
  assert.match(sidebar, /capInvite:/);
  assert.match(sidebar, /lowHint:/);
  assert.match(sidebar, /support@onwan\.eu/);
  // discretionary, never promised
  assert.match(sidebar, /where I can/);
  assert.match(sidebar, /قدر الإمكان/);
  assert.doesNotMatch(sidebar, /free software/i);
  // The panel toggle is user-visible behaviour that string presence cannot catch:
  // an inverted `hidden` would show the panel to everyone and hide it at zero.
  assert.match(sidebar, /capPanel\.hidden\s*=\s*!atCap/);
  assert.match(sidebar, /state\.entitlement\.freeActionsRemaining\s*===\s*0/);
  assert.match(sidebar, /left\s*>\s*0\s*&&\s*left\s*<=\s*5/);
});

// --- Readiness model -------------------------------------------------------
// Unlike the assertions above, these execute the code. The readiness helpers are pure
// (title strings and body text in, plain objects out) precisely so they can be run here
// instead of pattern-matched. Only getDocState_ itself touches DocumentApp.
function loadReadiness() {
  const source =
    read('Workspace.js') + '\n' + read('Prompts.js') + '\n' + read('Readiness.js');
  const exported = [
    'docRoleForTitle_',
    'proposalSignalStrength_',
    'readinessFromTabs_',
    'gateForAction_',
    'nextStepFor_',
    'ACTION_DEFS',
  ];
  // Export each name only if it has been defined, so a test for one missing helper
  // fails on its own assertion rather than on a ReferenceError from an unrelated name.
  const fields = exported
    .map((name) => `${name}: typeof ${name} === 'undefined' ? undefined : ${name}`)
    .join(',');
  return new Function(`${source}\nreturn {${fields}};`)();
}

test('document tab titles map to workflow roles in both locales', () => {
  const { docRoleForTitle_ } = loadReadiness();
  assert.equal(docRoleForTitle_('Proposal'), 'proposal');
  assert.equal(docRoleForTitle_('المقترح'), 'proposal');
  assert.equal(docRoleForTitle_('Approved proposal'), 'approvedProposal');
  assert.equal(docRoleForTitle_('Draft'), 'draft');
  assert.equal(docRoleForTitle_('المسودة'), 'draft');
  assert.equal(docRoleForTitle_('Source library'), 'sourceLibrary');
});

test('tab title matching tolerates the casing and spacing of hand-typed titles', () => {
  // proposalArchitectureMarkdown_ asks the user to create these tabs by hand, so the
  // titles are typed, not generated, and will not match byte for byte.
  const { docRoleForTitle_ } = loadReadiness();
  assert.equal(docRoleForTitle_('  draft  '), 'draft');
  assert.equal(docRoleForTitle_('FINAL STORY'), 'finalStory');
  assert.equal(docRoleForTitle_('Evidence '), 'evidence');
  assert.equal(docRoleForTitle_('Chapter notes'), '');
  assert.equal(docRoleForTitle_(''), '');
});

test('proposal strength separates an empty doc, a bare topic, and a real proposal', () => {
  const { proposalSignalStrength_ } = loadReadiness();
  const topic = 'ارتفاع أسعار الدواء في المغرب';
  const long = new Array(90).fill('كلمة').join(' ');
  const shortWithSignals =
    'الزاوية: لماذا الآن ارتفعت الأسعار. الأسئلة الرئيسية والأدلة المتاحة. ' +
    new Array(45).fill('كلمة').join(' ');
  assert.equal(proposalSignalStrength_(''), 'blank');
  assert.equal(proposalSignalStrength_('   '), 'blank');
  assert.equal(proposalSignalStrength_(topic), 'topic');
  assert.equal(proposalSignalStrength_(long), 'proposal');
  assert.equal(proposalSignalStrength_(shortWithSignals), 'proposal');
});

const proposalText = new Array(90).fill('كلمة').join(' ');
const draftText = new Array(130).fill('كلمة').join(' ');

test('readiness reads the proposal and draft from their own tabs', () => {
  const { readinessFromTabs_ } = loadReadiness();
  const state = readinessFromTabs_([
    { title: 'Proposal', text: proposalText },
    { title: 'Draft', text: draftText },
  ]);
  assert.equal(state.tabsPresent, true);
  assert.equal(state.hasText, true);
  assert.equal(state.hasProposal, true);
  assert.equal(state.hasDraft, true);
});

test('a proposal tab holding only a topic line is not a proposal yet', () => {
  const { readinessFromTabs_ } = loadReadiness();
  const state = readinessFromTabs_([
    { title: 'المقترح', text: 'ارتفاع أسعار الدواء' },
    { title: 'المسودة', text: '' },
  ]);
  assert.equal(state.hasProposal, false);
  assert.equal(state.hasDraft, false);
  assert.equal(state.hasText, true);
});

test('a long draft in another tab does not count as a proposal', () => {
  // Length alone must not unlock research and fieldwork; those need an actual proposal.
  const { readinessFromTabs_ } = loadReadiness();
  const state = readinessFromTabs_([
    { title: 'Proposal', text: '' },
    { title: 'Draft', text: draftText },
  ]);
  assert.equal(state.hasProposal, false);
  assert.equal(state.hasDraft, true);
});

test('readiness falls back to the whole document when no tabs are recognised', () => {
  // Most users never create the tab structure that proposalArchitectureMarkdown_ suggests.
  const { readinessFromTabs_ } = loadReadiness();
  const untitled = readinessFromTabs_([{ title: 'Untitled document', text: proposalText }]);
  assert.equal(untitled.tabsPresent, false);
  assert.equal(untitled.hasProposal, true);
  assert.equal(untitled.hasDraft, true);
  const empty = readinessFromTabs_([{ title: 'Untitled document', text: '' }]);
  assert.equal(empty.hasText, false);
  assert.equal(empty.hasProposal, false);
  assert.equal(empty.hasDraft, false);
});

test('readiness survives a document with no readable tabs at all', () => {
  const { readinessFromTabs_ } = loadReadiness();
  const state = readinessFromTabs_([]);
  assert.equal(state.hasText, false);
  assert.equal(state.hasProposal, false);
  assert.equal(state.hasDraft, false);
  assert.equal(state.tabsPresent, false);
});

test('every gated action names both what it needs and the step that supplies it', () => {
  const { ACTION_DEFS, gateForAction_ } = loadReadiness();
  const blank = { hasText: false, hasProposal: false, hasDraft: false };
  Object.keys(ACTION_DEFS).forEach((actionId) => {
    const gate = gateForAction_(actionId, blank);
    assert.equal(typeof gate.ready, 'boolean', `${actionId} must report readiness`);
    if (!gate.ready) {
      assert.ok(gate.requires, `${actionId} must say what is missing`);
      assert.ok(
        ACTION_DEFS[gate.unblockedBy],
        `${actionId} must point at a real action, got ${gate.unblockedBy}`
      );
    }
  });
});

test('research and fieldwork wait for a proposal, not merely for text', () => {
  const { gateForAction_ } = loadReadiness();
  const draftOnly = { hasText: true, hasProposal: false, hasDraft: true };
  ['research', 'fieldworkPlan'].forEach((actionId) => {
    const gate = gateForAction_(actionId, draftOnly);
    assert.equal(gate.ready, false, `${actionId} must stay gated`);
    assert.equal(gate.requires, 'hasProposal');
    assert.equal(gate.unblockedBy, 'proposal');
  });
});

test('fact-checking waits for a draft', () => {
  const { gateForAction_ } = loadReadiness();
  const proposalOnly = { hasText: true, hasProposal: true, hasDraft: false };
  const gate = gateForAction_('claimCheck', proposalOnly);
  assert.equal(gate.ready, false);
  assert.equal(gate.requires, 'hasDraft');
  const ready = gateForAction_('claimCheck', {
    hasText: true,
    hasProposal: true,
    hasDraft: true,
  });
  assert.equal(ready.ready, true);
});

test('the proposal step itself is never gated on a blank document', () => {
  // Gating the entry point would leave a new user with nothing they are allowed to click.
  const { gateForAction_ } = loadReadiness();
  const blank = { hasText: false, hasProposal: false, hasDraft: false };
  assert.equal(gateForAction_('proposal', blank).ready, true);
  assert.equal(gateForAction_('proposalIdeas', blank).ready, true);
});

test('the document scan stays on the current-document path and is bounded', () => {
  const readiness = read('Readiness.js');
  assert.match(readiness, /function getDocState\(\)/);
  // Same constraint as bodyForTabId_: reach tabs through the active document, never by id.
  assert.match(readiness, /getActiveDocument\(\)/);
  assert.match(readiness, /getTabs\s*\(/);
  assert.match(readiness, /getChildTabs\s*\(/);
  // A full read of every tab on every sidebar open would be slow on a long investigation.
  assert.match(readiness, /READINESS_SCAN_CHARS/);
  assert.match(readiness, /substring\(0, READINESS_SCAN_CHARS\)/);
  assert.match(readiness, /CacheService\.getUserCache\(\)/);
});

test('a failed readiness scan opens every step rather than locking the sidebar', () => {
  // The gate is a hint, not an authorisation check. If the scan throws, the user must not
  // be left staring at a sidebar where nothing is clickable.
  const readiness = read('Readiness.js');
  const fallback = readiness.slice(readiness.indexOf('function permissiveDocState_'));
  assert.match(fallback, /hasText: true/);
  assert.match(fallback, /hasProposal: true/);
  assert.match(fallback, /hasDraft: true/);
  assert.match(readiness, /catch[\s\S]{0,80}permissiveDocState_\(\)/);
});

test('a completed action refreshes the cached readiness state', () => {
  const actions = read('Actions.js');
  assert.match(actions, /docStateClear_\(\)/);
  assert.match(read('Readiness.js'), /function docStateClear_\(\)/);
});

test('the gating rules live on the server and are not restated in the sidebar', () => {
  // One table, in Prompts.js beside ACTION_DEFS. A second copy in the panel would drift.
  const sidebar = read('Sidebar.html');
  assert.match(read('Readiness.js'), /function getDocGates\(\)/);
  assert.match(sidebar, /\.getDocGates\(\)/);
  // Match a definition, not prose: a comment in the panel may name the server-side table.
  assert.doesNotMatch(sidebar, /ACTION_PREREQUISITES\s*=/);
  assert.doesNotMatch(sidebar, /hasProposal:\s*(true|false)/);
});

test('every gated step carries the action id its button runs', () => {
  const sidebar = read('Sidebar.html');
  ['research', 'fieldworkPlan', 'storyFramework', 'editDraft', 'claimCheck'].forEach(
    (actionId) =>
      assert.match(
        sidebar,
        new RegExp(`data-action="${actionId}"`),
        `${actionId} needs a data-action attribute for the gate to find it`
      )
  );
});

test('a step that is not ready explains itself instead of failing after a call', () => {
  const sidebar = read('Sidebar.html');
  assert.match(sidebar, /function renderGates\(\)/);
  assert.match(sidebar, /function showGateCard\(/);
  assert.match(sidebar, /classList\.toggle\('not-ready'/);
  // The explanation must appear before any backend work happens.
  assert.match(sidebar, /function runActionUi\(actionId, force\)/);
  assert.match(sidebar, /if \(!force[\s\S]{0,120}showGateCard\([\s\S]{0,40}return;/);
});

test('the soft gate always leaves a way through', () => {
  // A dimmed button is a signpost, not a lock: the user can still proceed, and is offered
  // the step that would unblock this one.
  const sidebar = read('Sidebar.html');
  assert.match(sidebar, /runAnyway/);
  assert.match(sidebar, /runActionUi\(pending, true\)/);
  assert.doesNotMatch(sidebar, /not-ready[\s\S]{0,200}\.disabled = true/);
});

test('the sidebar names the next useful step', () => {
  const sidebar = read('Sidebar.html');
  assert.match(sidebar, /id="next-step"/);
  assert.match(sidebar, /function renderNextStep\(/);
});

test('readiness is refreshed on open and after each completed action', () => {
  const sidebar = read('Sidebar.html');
  assert.match(sidebar, /function refreshGates\(\)/);
  const load = sidebar.slice(sidebar.indexOf('function load()'));
  assert.match(load, /refreshGates\(\)/);
  const runAction = sidebar.slice(
    sidebar.indexOf('function runActionUi'),
    sidebar.indexOf('function retryWrite')
  );
  assert.match(runAction, /refreshGates\(\)/);
});

test('the recommended next step follows the state of the document', () => {
  const { nextStepFor_ } = loadReadiness();
  assert.equal(
    nextStepFor_({ hasText: false, hasProposal: false, hasDraft: false }),
    'proposal'
  );
  assert.equal(
    nextStepFor_({ hasText: true, hasProposal: false, hasDraft: false }),
    'proposal'
  );
  assert.equal(
    nextStepFor_({ hasText: true, hasProposal: true, hasDraft: false }),
    'storyFramework'
  );
  assert.equal(
    nextStepFor_({ hasText: true, hasProposal: true, hasDraft: true }),
    'claimCheck'
  );
});
