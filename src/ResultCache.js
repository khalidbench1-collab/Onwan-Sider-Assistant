var RESULT_CACHE_SECS = 21600;
var LAST_PROPOSAL_KEY = 'onwan:lastProposal';
var PENDING_WRITE_KEY = 'onwan:pendingWrite';

function lastProposalPut_(text) {
  try {
    CacheService.getUserCache().put(
      LAST_PROPOSAL_KEY,
      String(text || ''),
      RESULT_CACHE_SECS
    );
  } catch (e) {}
}

function lastProposalGet_() {
  try {
    return CacheService.getUserCache().get(LAST_PROPOSAL_KEY) || null;
  } catch (e) {
    return null;
  }
}

function pendingWritePut_(value) {
  try {
    CacheService.getUserCache().put(
      PENDING_WRITE_KEY,
      JSON.stringify(value),
      RESULT_CACHE_SECS
    );
  } catch (e) {
    throw new AppError('WRITE_FAILED');
  }
}

function pendingWriteGet_() {
  try {
    var raw = CacheService.getUserCache().get(PENDING_WRITE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function pendingWriteClear_() {
  CacheService.getUserCache().remove(PENDING_WRITE_KEY);
}

function devTestResultCache() {
  lastProposalPut_('مقترح تجريبي');
  Logger.log('proposal: ' + (lastProposalGet_() === 'مقترح تجريبي' ? 'PASS' : 'FAIL'));
  pendingWritePut_({
    actionId: 'proposal',
    markdown: '# نتيجة تجريبية',
    language: 'ar',
    requestId: 'fixture',
  });
  Logger.log('pending write: ' + (pendingWriteGet_() ? 'PASS' : 'FAIL'));
  pendingWriteClear_();
  Logger.log('clear: ' + (!pendingWriteGet_() ? 'PASS' : 'FAIL'));
}
