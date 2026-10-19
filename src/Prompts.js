var ACTION_DEFS = {
  proposalIdeas: { usesStyle: true, wholeDoc: false, resultKind: 'ideas' },
  proposal: { usesStyle: true, wholeDoc: false, resultKind: 'document' },
  research: { usesStyle: false, usesProposal: true, wholeDoc: false, resultKind: 'document' },
  fieldworkPlan: {
    usesStyle: false,
    usesProposal: true,
    wholeDoc: false,
    resultKind: 'document',
  },
  storyFramework: { usesStyle: false, wholeDoc: false, resultKind: 'document' },
  editDraft: { usesStyle: true, wholeDoc: false, resultKind: 'edited' },
  claimCheck: { usesStyle: false, wholeDoc: false, resultKind: 'document' },
};

// What each step needs before it can produce anything worth reading, and which step
// supplies it. The sidebar reads this to explain a dimmed button; runAction keeps its own
// EMPTY / NEED_PROPOSAL checks as the backstop for anyone who proceeds anyway.
var ACTION_PREREQUISITES = {
  research: { requires: 'hasProposal', unblockedBy: 'proposal' },
  fieldworkPlan: { requires: 'hasProposal', unblockedBy: 'proposal' },
  storyFramework: { requires: 'hasText', unblockedBy: 'proposal' },
  editDraft: { requires: 'hasDraft', unblockedBy: 'storyFramework' },
  claimCheck: { requires: 'hasDraft', unblockedBy: 'editDraft' },
};
