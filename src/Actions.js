function runAction(actionId, payload) {
  payload = payload || {};
  try {
    if (actionId === 'editArabic') actionId = 'editDraft';
    var def = ACTION_DEFS[actionId];
    if (!def) throw new AppError('UNKNOWN');

    var target;
    if (actionId === 'proposal') {
      var wizardText = payload.contextId
        ? proposalContextGet_(payload.contextId)
        : '';
      if (wizardText) {
        target = { text: wizardText, isSelection: false };
      } else if (payload.ideaText || payload.selectedAngle) {
        target = { text: '', isSelection: false };
      } else {
        target = getTargetText();
      }
      if (!target.text.trim() && !String(payload.ideaText || '').trim()) {
        throw new AppError('EMPTY');
      }
    } else if (def.usesProposal) {
      var currentTarget = getTargetText();
      var proposalText = currentTarget.text.trim()
        ? currentTarget.text
        : lastProposalGet_();
      if (!proposalText) throw new AppError('NEED_PROPOSAL');
      target = {
        text: proposalText,
        isSelection: !!currentTarget.isSelection,
      };
    } else {
      target = getTargetText();
      if (!target.text.trim()) {
        throw new AppError('EMPTY');
      }
    }

    var language = projectLanguageRequest_(target.text || payload.ideaText || payload.domain || '');
    var request = {
      actionId: actionId,
      clientRequestId: Utilities.getUuid(),
      inputs: {
        targetText: target.text,
        styleProfile: def.usesStyle ? getStyleProfile() : '',
        domain: String(payload.domain || '').trim(),
        ideaText: String(payload.ideaText || '').trim(),
        selectedAngle: String(payload.selectedAngle || '').trim(),
        storyType: payload.projectType === 'investigation' ? 'investigation' : 'quick',
      },
      uiLocale: getUiLocale_() || 'ar',
      outputLanguage: language.outputLanguage,
      projectLanguageHint: language.hint,
    };

    var response = callOnwan_('/v1/generate', 'post', request);
    var generatedMarkdown = response.result.markdown;
    var documentMarkdown = generatedMarkdown;
    if (actionId === 'proposal') {
      documentMarkdown += proposalArchitectureMarkdown_(
        payload.projectType === 'investigation' ? 'investigation' : 'quick',
        response.language.used
      );
    }
    var writeState = {
      actionId: actionId,
      markdown: documentMarkdown,
      proposalMarkdown: actionId === 'proposal' ? generatedMarkdown : '',
      language: response.language.used,
      requestId: response.requestId,
    };
    pendingWritePut_(writeState);

    try {
      var destination = writeGeneratedResult_(
        writeState.actionId,
        writeState.markdown,
        writeState.language
      );
      pendingWriteClear_();
      docStateClear_();
      rememberDetectedProjectLanguage_(writeState.language);
      if (actionId === 'proposal') lastProposalPut_(writeState.proposalMarkdown);
      return {
        ok: true,
        data: {
          destination: destination,
          language: writeState.language,
          entitlement: response.entitlement,
          credits: response.credits,
          model: response.model,
          retryAvailable: false,
        },
      };
    } catch (writeError) {
      return {
        ok: false,
        error: errorMessage_('WRITE_FAILED'),
        retryAvailable: true,
        entitlement: response.entitlement,
      };
    }
  } catch (err) {
    return { ok: false, error: humanError(err), retryAvailable: !!pendingWriteGet_() };
  }
}

function retryLastWrite() {
  var pending = pendingWriteGet_();
  if (!pending) return { ok: false, error: errorMessage_('NO_RETRY') };
  try {
    var destination = writeGeneratedResult_(
      pending.actionId,
      pending.markdown,
      pending.language
    );
    pendingWriteClear_();
    docStateClear_();
    rememberDetectedProjectLanguage_(pending.language);
    if (pending.actionId === 'proposal') {
      lastProposalPut_(pending.proposalMarkdown || pending.markdown);
    }
    return {
      ok: true,
      data: {
        destination: destination,
        language: pending.language,
        retryAvailable: false,
      },
    };
  } catch (err) {
    return { ok: false, error: errorMessage_('WRITE_FAILED'), retryAvailable: true };
  }
}

function getProposalWizardContext() {
  try {
    var target = getTargetText();
    var text = String(target.text || '').trim();
    var meaningful = proposalSignalStrength_(text) === 'proposal';
    var contextId = '';
    if (meaningful) {
      contextId = Utilities.getUuid();
      CacheService.getUserCache().put(
        'ONWAN_PROPOSAL_CONTEXT_' + contextId,
        text,
        900
      );
    }
    var investigationSignal =
      /(?:تحقيق|investigation|enqu[eê]te|فساد|corruption|مساءلة|accountability|وثائق|documents?)/i.test(
        text
      );
    return {
      ok: true,
      data: {
        mode: meaningful ? 'proposal' : text ? 'topic' : 'blank',
        contextId: contextId,
        topicText: meaningful ? '' : text,
        sample: meaningful ? text.substring(0, 240) : '',
        recommendedStoryType: investigationSignal ? 'investigation' : 'quick',
      },
    };
  } catch (err) {
    return { ok: false, error: humanError(err) };
  }
}

function proposalContextGet_(contextId) {
  return (
    CacheService.getUserCache().get(
      'ONWAN_PROPOSAL_CONTEXT_' + String(contextId || '')
    ) || ''
  );
}

function suggestProposalAngles(payload) {
  payload = payload || {};
  try {
    var topic = String(payload.ideaText || '').trim();
    if (!topic) throw new AppError('EMPTY');
    var language = projectLanguageRequest_(topic);
    var request = {
      actionId: 'proposalIdeas',
      clientRequestId: Utilities.getUuid(),
      inputs: {
        targetText: '',
        styleProfile: '',
        domain: '',
        ideaText: topic,
        selectedAngle: '',
        storyType: payload.projectType === 'investigation'
          ? 'investigation'
          : 'quick',
      },
      uiLocale: getUiLocale_() || 'ar',
      outputLanguage: language.outputLanguage,
      projectLanguageHint: language.hint,
    };
    var response = callOnwan_('/v1/generate', 'post', request);
    if (
      !response.result ||
      !response.result.preview ||
      !response.result.preview.ideas ||
      response.result.preview.ideas.length !== 3
    ) {
      throw new AppError('BACKEND_ERROR');
    }
    return {
      ok: true,
      data: {
        preview: response.result.preview,
        entitlement: response.entitlement,
        credits: response.credits,
      },
    };
  } catch (err) {
    return { ok: false, error: humanError(err) };
  }
}

function completeProposalWizard(payload) {
  payload = payload || {};
  return runAction('proposal', payload);
}
