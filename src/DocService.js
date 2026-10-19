var MAX_DOC_CHARS = 150000;

function activeBody_() {
  var doc = DocumentApp.getActiveDocument();
  try {
    if (typeof doc.getActiveTab === 'function') {
      var tab = doc.getActiveTab();
      if (tab && typeof tab.asDocumentTab === 'function') {
        return tab.asDocumentTab().getBody();
      }
    }
  } catch (e) {}
  return doc.getBody();
}

function activeTabTitle_() {
  var doc = DocumentApp.getActiveDocument();
  try {
    if (typeof doc.getActiveTab === 'function') {
      var tab = doc.getActiveTab();
      if (tab && typeof tab.getTitle === 'function') return tab.getTitle();
    }
  } catch (e) {}
  return doc.getName();
}

function getTargetText() {
  var doc = DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  if (selection) {
    var parts = selection.getRangeElements().map(rangeElementText_);
    var joined = parts.join('\n').trim();
    if (joined) return { text: joined, isSelection: true };
  }
  var body = activeBody_();
  var text = body.getText();
  if (text.length > MAX_DOC_CHARS) throw new AppError('TOO_LONG');
  return { text: text, isSelection: false };
}

function rangeElementText_(re) {
  var el = re.getElement();
  if (re.isPartial()) {
    return el
      .asText()
      .getText()
      .substring(re.getStartOffset(), re.getEndOffsetInclusive() + 1);
  }
  if (el.getType() === DocumentApp.ElementType.TEXT) return el.asText().getText();
  try {
    return el.getText();
  } catch (e) {
    return '';
  }
}

function bodyForTabId_(tabId) {
  if (!tabId) return activeBody_();
  // Reach the tab through the active document. Reopening it with DocumentApp.openById would
  // require the broad auth/documents scope even though it is the very same file, and that scope
  // is sensitive at OAuth verification.
  var doc = DocumentApp.getActiveDocument();
  var tab = typeof doc.getTab === 'function' ? doc.getTab(tabId) : null;
  if (!tab || typeof tab.asDocumentTab !== 'function') throw new AppError('WORKSPACE_FAILED');
  return tab.asDocumentTab().getBody();
}

function writeGeneratedResult_(actionId, markdown, language, destinationTabId, destinationTitle) {
  var body = bodyForTabId_(destinationTabId);
  var index = body.getNumChildren();
  if (actionId === 'editDraft') index = reviewInsertionIndex_(body);
  insertStructuredAt_(body, index, markdown, isRtlLanguage_(language));
  return destinationTitle || activeTabTitle_();
}

function reviewInsertionIndex_(body) {
  var doc = DocumentApp.getActiveDocument();
  var selection = doc.getSelection();
  if (!selection) return body.getNumChildren();
  var elements = selection.getRangeElements();
  if (!elements.length) return body.getNumChildren();
  var anchor = elements[elements.length - 1].getElement();
  while (
    anchor.getParent() &&
    anchor.getParent().getType() !== DocumentApp.ElementType.BODY_SECTION
  ) {
    anchor = anchor.getParent();
  }
  try {
    return body.getChildIndex(anchor) + 1;
  } catch (e) {
    return body.getNumChildren();
  }
}

function insertStructuredAt_(body, startIndex, markdown, rtl) {
  var headings = [
    DocumentApp.ParagraphHeading.HEADING1,
    DocumentApp.ParagraphHeading.HEADING2,
    DocumentApp.ParagraphHeading.HEADING3,
  ];
  var index = startIndex;
  String(markdown)
    .split('\n')
    .forEach(function (raw) {
      var line = raw.replace(/\s+$/, '');
      var m;
      var element;
      if (!line.trim()) {
        element = body.insertParagraph(index++, '');
      } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        element = insertFormatted_(m[2], function (text) {
          return body
            .insertParagraph(index++, text)
            .setHeading(headings[m[1].length - 1]);
        });
      } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
        element = insertFormatted_(m[1], function (text) {
          return body
            .insertListItem(index++, text)
            .setGlyphType(DocumentApp.GlyphType.BULLET);
        });
      } else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
        element = insertFormatted_(m[1], function (text) {
          return body
            .insertListItem(index++, text)
            .setGlyphType(DocumentApp.GlyphType.NUMBER);
        });
      } else {
        element = insertFormatted_(line, function (text) {
          return body.insertParagraph(index++, text);
        });
      }
      setDirection_(element, rtl);
    });
}

function insertFormatted_(src, insertFn) {
  var parsed = parseInline_(src);
  var element = insertFn(parsed.text);
  var text = element.editAsText();
  parsed.bolds.forEach(function (range) {
    if (range.end >= range.start) text.setBold(range.start, range.end, true);
  });
  parsed.links.forEach(function (range) {
    if (range.end >= range.start)
      text.setLinkUrl(range.start, range.end, range.url);
  });
  return element;
}

function setDirection_(element, rtl) {
  try {
    if (typeof element.setLeftToRight === 'function') element.setLeftToRight(!rtl);
  } catch (e) {}
}

function parseInline_(src) {
  var out = '';
  var bolds = [];
  var links = [];
  var i = 0;
  while (i < src.length) {
    if (src.substr(i, 2) === '**') {
      var close = src.indexOf('**', i + 2);
      if (close > -1) {
        bolds.push({ start: out.length, end: out.length + close - i - 3 });
        out += src.substring(i + 2, close);
        i = close + 2;
        continue;
      }
    }
    if (src[i] === '[') {
      var middle = src.indexOf('](', i);
      var closeParen = middle > -1 ? src.indexOf(')', middle + 2) : -1;
      if (middle > -1 && closeParen > -1) {
        var label = src.substring(i + 1, middle);
        var url = src.substring(middle + 2, closeParen);
        if (/^https?:\/\//i.test(url)) {
          links.push({
            start: out.length,
            end: out.length + label.length - 1,
            url: url,
          });
        }
        out += label;
        i = closeParen + 1;
        continue;
      }
    }
    out += src[i];
    i += 1;
  }
  return { text: out, bolds: bolds, links: links };
}

function devTestFormatter() {
  insertStructuredAt_(
    activeBody_(),
    activeBody_().getNumChildren(),
    '# عنوان رئيسي\n## عنوان فرعي\nفقرة فيها **نص غامق** ورابط [مثال](https://example.com).\n- بند أول\n1. خطوة أولى',
    true
  );
}
