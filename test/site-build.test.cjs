// Static checks on the generated public site. The site build had no coverage at all, so nothing
// caught a broken legal route or the owner's home address reappearing on a page that must not
// carry it.
//
// This runs `site/build.mjs` for real. That wipes and rewrites site/public, which is gitignored
// generated output and is rebuilt identically by `npm run build:site`, so the side effect is safe.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'site', 'public');

// The four routes are published legal/support obligations, not decoration: Google's Marketplace
// review requires Terms, Privacy and Support to exist and be reachable, and § 5 DDG requires the
// Impressum. Their URLs are load-bearing and must not drift.
const ROUTES = ['impressum', 'datenschutz', 'terms', 'support'];

// Added 2026-08-27: Home/Services/About, rebuilt from three exact Stitch mockups plus a training
// offer reframed from a separate consulting prototype. Not legal pages, but real routes with real
// nav links pointing at them, so they get the same existence/link coverage.
const MARKETING_ROUTES = ['services', 'about'];

execFileSync(process.execPath, [path.join(root, 'site', 'build.mjs')], {
  stdio: 'pipe',
  env: { ...process.env, ONWAN_EXAMPLE_ADDRESS: '1' },
});

// Added 2026-08-27: the Arabic translation of Home/Services/About, at /ar, /ar/services and
// /ar/about -- same slugs as MARKETING_ROUTES, prefixed. The legal pages are out of scope for this
// translation and stay English/German-only.
const AR_MARKETING_ROUTES = ['ar', 'ar/services', 'ar/about'];

const read = (...parts) => fs.readFileSync(path.join(out, ...parts), 'utf8');

// The street the build rendered: the gitignored local file when present, else the committed example.
const addressFile = ['postal-address.local.json', 'postal-address.example.json']
  .map((name) => path.join(root, 'site', name))
  .find((file) => fs.existsSync(file));
const postalStreet = JSON.parse(fs.readFileSync(addressFile, 'utf8')).street;
const home = read('index.html');
const services = read('services', 'index.html');
const about = read('about', 'index.html');
const homeAr = read('ar', 'index.html');
const servicesAr = read('ar', 'services', 'index.html');
const aboutAr = read('ar', 'about', 'index.html');

test('the build emits the homepage and every legal route', () => {
  assert(fs.existsSync(path.join(out, 'index.html')), 'homepage must exist');
  for (const slug of ROUTES) {
    assert(fs.existsSync(path.join(out, slug, 'index.html')), `/${slug} must exist`);
  }
});

test('the build emits /services and /about, linked from every page\'s nav', () => {
  for (const slug of MARKETING_ROUTES) {
    assert(fs.existsSync(path.join(out, slug, 'index.html')), `/${slug} must exist`);
  }
  for (const file of ['index.html', ...ROUTES.map((slug) => `${slug}/index.html`)]) {
    const html = read(...file.split('/'));
    for (const slug of MARKETING_ROUTES) {
      assert.match(html, new RegExp(`href="/${slug}"`), `${file} must link /${slug} from its nav`);
    }
  }
});

test('the homepage links every legal route', () => {
  for (const slug of ROUTES) {
    assert.match(home, new RegExp(`href="/${slug}"`), `homepage must link /${slug}`);
  }
});

test('the postal address is published only on the Impressum', () => {
  // Owner decision 2026-08-27: the home address stays on the Impressum, which legally requires it
  // under § 5 DDG, and comes off every other page. Datenschutz and Terms name the Impressum
  // instead, which keeps the controller's contact details reachable for GDPR Art. 13.
  const carrying = [
    'index.html',
    'services/index.html',
    'about/index.html',
    'ar/index.html',
    'ar/services/index.html',
    'ar/about/index.html',
    ...ROUTES.map((slug) => `${slug}/index.html`),
  ].filter((file) => read(...file.split('/')).includes(postalStreet));
  assert.deepEqual(carrying, ['impressum/index.html']);
});

test('the pages that dropped the address still route to the Impressum', () => {
  for (const slug of ['datenschutz', 'terms']) {
    assert.match(read(slug, 'index.html'), /href="\/impressum"/, `/${slug} must link the Impressum`);
  }
});

test('the legal pages carry the Google trademark attribution', () => {
  // A Marketplace reviewer rejected the listing on 2026-08-11 for missing trademark attribution on
  // Google product names. It is a review condition, not a nicety.
  for (const slug of ROUTES) {
    const html = read(slug, 'index.html');
    assert.match(html, /trademarks of Google LLC/, `/${slug} must attribute the marks`);
    assert.match(html, /not affiliated with, endorsed by, or sponsored by Google LLC/, slug);
  }
});

test('Home, Services and About use no trademark symbol, having dropped the attribution', () => {
  // Owner decision 2026-08-27: the attribution footnote comes off every marketing page (not just
  // the homepage, once Services and About joined it). Carrying the symbol without the notice beside
  // it would be worse than not carrying it at all. If a (TM) comes back, so must the notice. The
  // Arabic pages share the same siteFooter() call and must behave identically.
  for (const [name, html] of [
    ['home', home],
    ['services', services],
    ['about', about],
    ['ar/home', homeAr],
    ['ar/services', servicesAr],
    ['ar/about', aboutAr],
  ]) {
    assert.doesNotMatch(html, /&trade;|™/, `${name} must not carry the trademark symbol`);
  }
});

test('no page uses the wrong contact email', () => {
  // The About Stitch mockup ended in a stray mailto:khalid@onwan.com -- a domain this site does not
  // own. The real address is used everywhere else on the site; About must match, not the mockup.
  for (const file of [
    'index.html',
    'services/index.html',
    'about/index.html',
    'ar/index.html',
    'ar/services/index.html',
    'ar/about/index.html',
    ...ROUTES.map((slug) => `${slug}/index.html`),
  ]) {
    assert.doesNotMatch(read(...file.split('/')), /khalid@onwan\.com/, `${file} must not use the wrong domain`);
  }
});

test('the homepage screenshots are served from this origin', () => {
  // Content-Security-Policy in firebase.json sets img-src 'self', so an external image URL would
  // silently fail to load. Every <img> must be a same-origin absolute path with a real file.
  const sources = [...home.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert(sources.length > 0, 'homepage must show at least one image');
  for (const source of sources) {
    assert.match(source, /^\//, `${source} must be same-origin`);
    assert(fs.existsSync(path.join(out, source.slice(1))), `${source} must exist in the output`);
  }
});

test('/services has no form of its own, only the Typeform link', () => {
  // Owner decision 2026-08-27: the site's native forms never got a working Formspree endpoint
  // behind them and were dropped rather than shipped half-wired. Typeform is now the only request
  // path, as a plain outbound link -- so no page should contain a <form> at all, and firebase.json
  // can keep form-action 'none' rather than carving out an exception nothing here needs.
  assert.doesNotMatch(services, /<form\b/, '/services must not contain a <form>');
  const link = services.match(/<a[^>]+href="(https:\/\/form\.typeform\.com\/to\/[^"]+)"[^>]*>/);
  assert(link, '/services must link to a form.typeform.com/to/... form');
  assert.match(link[0], /target="_blank"/, 'the Typeform link must open in a new tab');
  assert.match(link[0], /rel="noopener noreferrer"/, 'the Typeform link must not leak a window handle');
});

test('no page contains a <form> element', () => {
  // Confirms firebase.json's form-action 'none' is honest: nothing on the built site ever submits
  // an HTML form, so the CSP does not need to allow anywhere for one to POST to.
  for (const file of [
    'index.html',
    'services/index.html',
    'about/index.html',
    'ar/index.html',
    'ar/services/index.html',
    'ar/about/index.html',
    ...ROUTES.map((slug) => `${slug}/index.html`),
  ]) {
    assert.doesNotMatch(read(...file.split('/')), /<form\b/, `${file} must not contain a <form>`);
  }
});

test('the site loads no script and no external stylesheet or font host', () => {
  // The CSP sends default-src 'none' with no script-src, so a <script> tag or external stylesheet
  // would be blocked in the browser and break silently. font-src 'self' (added alongside the new
  // marketing pages) permits @font-face only when it points back at this origin -- fonts.googleapis.com
  // is still not in the CSP and must not appear.
  for (const file of [
    'index.html',
    'services/index.html',
    'about/index.html',
    'ar/index.html',
    'ar/services/index.html',
    'ar/about/index.html',
    ...ROUTES.map((slug) => `${slug}/index.html`),
  ]) {
    const html = read(...file.split('/'));
    assert.doesNotMatch(html, /<script/i, `${file} must contain no script`);
    assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/i, `${file} must not link a stylesheet`);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i, `${file} must not load a Google Fonts URL`);
    for (const face of html.matchAll(/@font-face\s*{[^}]*}/g)) {
      assert.match(face[0], /url\(['"]\/fonts\//, `${file}: every @font-face must be same-origin`);
    }
  }
});

test('the build emits /ar, /ar/services and /ar/about, each right-to-left and cross-linked', () => {
  for (const slug of AR_MARKETING_ROUTES) {
    assert(fs.existsSync(path.join(out, ...slug.split('/'), 'index.html')), `/${slug} must exist`);
  }
  for (const [name, html] of [
    ['ar/home', homeAr],
    ['ar/services', servicesAr],
    ['ar/about', aboutAr],
  ]) {
    assert.match(html, /<html lang="ar" dir="rtl">/, `${name} must be lang="ar" dir="rtl"`);
  }
  // Every Arabic marketing page must link back to its English counterpart, and vice versa -- the
  // corner language icon (masthead()'s langSwitch) is the only way to move between the two trees.
  const pairs = [
    [home, '/ar'],
    [services, '/ar/services'],
    [about, '/ar/about'],
    [homeAr, '/'],
    [servicesAr, '/services'],
    [aboutAr, '/about'],
  ];
  for (const [html, target] of pairs) {
    assert.match(
      html,
      new RegExp(`class="lang-switch" href="${target.replace(/\//g, '\\/')}"`),
      `must carry a language-switch link to ${target}`,
    );
  }
});

test('the Arabic pages are translated, not just relabelled', () => {
  // Guards against a future edit that duplicates HOME into HOME_AR without changing its body --
  // asserts real Arabic prose is present and none of the English hero copy leaked through.
  for (const [name, html] of [
    ['ar/home', homeAr],
    ['ar/services', servicesAr],
    ['ar/about', aboutAr],
  ]) {
    assert.match(html, /[؀-ۿ]{3,}/, `${name} must contain Arabic prose`);
  }
  assert.doesNotMatch(homeAr, /One Story, In Order/, 'ar/home must not carry the English H1');
  assert.doesNotMatch(servicesAr, /Taught Properly/, 'ar/services must not carry the English H1');
  assert.doesNotMatch(aboutAr, /Built by a Journalist/, 'ar/about must not carry the English H1');
});

test('the legal pages carry no language-switch icon (no Arabic translation exists for them)', () => {
  for (const slug of ROUTES) {
    assert.doesNotMatch(read(slug, 'index.html'), /class="lang-switch"/, `/${slug} must not offer a language switch`);
  }
});

test('the brand name is single-language, never the old "Onwan / عنوان" lockup', () => {
  // Owner decision 2026-08-27: every page shows the brand name in its own language only -- "Onwan"
  // on English/German pages, "عنوان" on Arabic ones -- not both at once.
  for (const [name, html] of [
    ['home', home],
    ['services', services],
    ['about', about],
    ['impressum', read('impressum', 'index.html')],
  ]) {
    assert.match(html, /<span class="brand-name">Onwan<\/span>/, `${name} masthead must read "Onwan"`);
    assert.match(html, /<p class="foot-brand">Onwan<\/p>/, `${name} footer must read "Onwan"`);
    assert.doesNotMatch(html, /brand-ar/, `${name} must not carry the old bilingual brand badge`);
  }
  for (const [name, html] of [
    ['ar/home', homeAr],
    ['ar/services', servicesAr],
    ['ar/about', aboutAr],
  ]) {
    assert.match(html, /<span class="brand-name" lang="ar">عنوان<\/span>/, `${name} masthead must read "عنوان"`);
    assert.match(html, /<p class="foot-brand" lang="ar">عنوان<\/p>/, `${name} footer must read "عنوان"`);
    assert.doesNotMatch(html, /Onwan \/ /, `${name} must not carry the old bilingual brand lockup`);
  }
});

test('every Arabic "install" button opens the CSS-only guide instead of jumping straight to Marketplace', () => {
  // Owner decision 2026-08-28: the site has no script-src at all, so a real JS dialog is not an
  // option -- every Arabic "install the add-on" control points at #install-guide (a :target panel)
  // instead of workspace.google.com directly. English pages are unaffected.
  for (const [name, html] of [
    ['ar/home', homeAr],
    ['ar/services', servicesAr],
    ['ar/about', aboutAr],
  ]) {
    assert.doesNotMatch(
      html,
      /class="cta" href="https:\/\/workspace\.google\.com/,
      `${name} masthead CTA must not link Marketplace directly`,
    );
    assert.match(html, /class="cta" href="#install-guide"/, `${name} masthead CTA must open #install-guide`);
    assert.match(html, /<div id="install-guide"/, `${name} must carry the #install-guide panel`);
    assert.match(
      html,
      /id="install-guide"[\s\S]*?href="https:\/\/workspace\.google\.com\/marketplace\/app\/onwan\/970590417505"[^>]*target="_blank"/,
      `${name}'s #install-guide panel must link Marketplace, opened in a new tab`,
    );
  }
  // Home's own hero and finale buttons must route through the guide too, not just the masthead.
  // Excludes the #install-guide panel's own button, which is the one place that must still link
  // Marketplace directly -- it IS the destination the guide exists to introduce.
  const [homeMain] = homeAr.split('<div id="install-guide"');
  const homeInstallButtons = [...homeMain.matchAll(/class="m-btn m-btn-primary" href="([^"]+)"/g)].map((m) => m[1]);
  assert(homeInstallButtons.length >= 2, 'ar/home must carry at least two primary install buttons');
  for (const href of homeInstallButtons) {
    assert.equal(href, '#install-guide', 'every ar/home primary install button must open #install-guide');
  }
  for (const [name, html] of [
    ['home', home],
    ['services', services],
    ['about', about],
  ]) {
    assert.doesNotMatch(html, /id="install-guide"/, `${name} must not carry the Arabic-only install guide`);
    assert.match(
      html,
      /class="cta" href="https:\/\/workspace\.google\.com\/marketplace\/app\/onwan\/970590417505"/,
      `${name} masthead CTA must still link Marketplace directly`,
    );
  }
});

test('the Arabic footer is translated: contact line, nav labels and aria-label', () => {
  for (const [name, html] of [
    ['ar/home', homeAr],
    ['ar/services', servicesAr],
    ['ar/about', aboutAr],
  ]) {
    assert.match(html, /برلين، ألمانيا/, `${name} footer must show "Berlin, Germany" in Arabic`);
    assert.match(html, /الرد خلال يوم عمل واحد/, `${name} footer must translate the reply-time line`);
    assert.match(html, /aria-label="روابط قانونية ودعم"/, `${name} footer nav must carry an Arabic aria-label`);
    // The email address itself, and the href targets, must stay untouched -- only the surrounding
    // prose and the nav labels are translated; the four legal pages remain English/German-only.
    assert.match(html, /href="mailto:support@onwan\.eu"/, `${name} must keep the real mailto`);
    assert.match(html, /href="\/impressum">Impressum<\/a>/, `${name} must keep Impressum untranslated`);
    assert.match(html, /href="\/datenschutz">سياسة الخصوصية<\/a>/, `${name} must translate the Datenschutz label`);
    assert.match(html, /href="\/terms">الشروط<\/a>/, `${name} must translate the Terms label`);
    assert.match(html, /href="\/support">الدعم<\/a>/, `${name} must translate the Support label`);
  }
  // English/German pages must be untouched by this change.
  for (const [name, html] of [
    ['home', home],
    ['services', services],
    ['about', about],
  ]) {
    assert.match(html, /replies within one business day/, `${name} footer must keep the English reply line`);
    assert.match(html, /aria-label="Legal and support"/, `${name} footer nav must keep the English aria-label`);
  }
});
