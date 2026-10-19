var WORKSPACE_TEMPLATES = {
  quick: {
    roots: [
      ['proposal', 'Proposal', 'المقترح'],
      ['sources', 'Sources & reporting', 'المصادر والعمل الصحفي'],
      ['draft', 'Draft', 'المسودة'],
      ['verification', 'Verification', 'التحقق'],
      ['visuals', 'Visuals', 'المواد البصرية'],
      ['finalStory', 'Final story', 'القصة النهائية'],
    ],
    children: [],
    proposalRole: 'proposal',
  },
  investigation: {
    roots: [
      ['proposal', 'Proposal', 'المقترح'],
      ['dashboard', 'Project Dashboard', 'لوحة المشروع'],
      ['evidence', 'Evidence', 'الأدلة'],
      ['reporting', 'Reporting', 'العمل الصحفي'],
      ['synthesis', 'Synthesis', 'التحليل والتركيب'],
      ['writing', 'Writing', 'الكتابة'],
      ['scratchpad', 'Scratchpad', 'مسودات وملاحظات'],
      ['postPublication', 'Post-publication', 'ما بعد النشر'],
    ],
    children: [
      ['status', 'Status & deadlines', 'الحالة والمواعيد', 'dashboard'],
      ['assignment', 'Assignment', 'التكليف', 'dashboard'],
      ['nextActions', 'Next actions', 'الخطوات التالية', 'dashboard'],
      ['brainstorming', 'Research / brainstorming', 'البحث / العصف الذهني', 'proposal'],
      ['angleHypotheses', 'Angle & hypotheses', 'الزاوية والفرضيات', 'proposal'],
      ['keyQuestions', 'Key questions', 'الأسئلة الرئيسية', 'proposal'],
      ['approvedProposal', 'Approved proposal', 'المقترح المعتمد', 'proposal'],
      ['sourceLibrary', 'Source library', 'مكتبة المصادر', 'evidence'],
      ['claimEvidence', 'Claim & evidence matrix', 'مصفوفة الادعاءات والأدلة', 'evidence'],
      ['timeline', 'Timeline', 'الخط الزمني', 'evidence'],
      ['sourceDirectory', 'Source directory', 'دليل المصادر', 'evidence'],
      ['permissionsRights', 'Permissions & rights', 'الأذونات والحقوق', 'evidence'],
      ['fieldwork', 'Fieldwork plan', 'خطة العمل الميداني', 'reporting'],
      ['interviews', 'Interviews', 'المقابلات', 'reporting'],
      ['observationNotes', 'Observation notes', 'ملاحظات الرصد', 'reporting'],
      ['rightOfReply', 'Right of reply', 'حق الرد', 'reporting'],
      ['evidenceGaps', 'Evidence gaps & next steps', 'فجوات الأدلة والخطوات التالية', 'reporting'],
      ['findings', 'Findings', 'النتائج', 'synthesis'],
      ['contradictions', 'Contradictions & uncertainty', 'التناقضات وعدم اليقين', 'synthesis'],
      ['verificationLog', 'Verification log', 'سجل التحقق', 'synthesis'],
      ['confirmedConclusions', 'Confirmed conclusions', 'الخلاصات المؤكدة', 'synthesis'],
      ['storyFramework', 'Story framework', 'هيكل القصة', 'writing'],
      ['draft', 'Draft', 'المسودة', 'writing'],
      ['visuals', 'Visuals', 'المواد البصرية', 'writing'],
      ['safetyReview', 'Editorial safety review', 'مراجعة السلامة التحريرية', 'writing'],
      ['finalStory', 'Final story', 'القصة النهائية', 'writing'],
      ['correctionsLog', 'Corrections log', 'سجل التصحيحات', 'postPublication'],
    ],
    proposalRole: 'approvedProposal',
  },
};

function proposalArchitectureMarkdown_(projectType, outputLanguage) {
  projectType = projectType === 'investigation' ? 'investigation' : 'quick';
  var template = WORKSPACE_TEMPLATES[projectType];
  var arabic = isRtlLanguage_(outputLanguage);
  var lines = [
    '',
    '',
    '# ' + (arabic ? 'بنية التبويبات المقترحة' : 'Recommended document tabs'),
    arabic
      ? '**الخطوة التالية:** أنشئ التبويبات التالية يدويًا في هذا المستند لتسهيل سير العمل الصحفي، ثم انقل المواد إلى مكانها المناسب عند الحاجة.'
      : '**Next step:** Create the following tabs manually in this document to organize the journalism workflow, then move material into the appropriate tab when needed.',
    '',
    '## ' +
      (projectType === 'investigation'
        ? arabic
          ? 'تحقيق'
          : 'Investigation'
        : arabic
          ? 'قصة سريعة'
          : 'Quick story'),
  ];
  template.roots.forEach(function (definition, index) {
    lines.push((index + 1) + '. **' + localizedWorkspaceTitle_(definition, arabic) + '**');
    template.children
      .filter(function (child) {
        return child[3] === definition[0];
      })
      .forEach(function (child) {
        lines.push('- ↳ ' + localizedWorkspaceTitle_(child, arabic));
      });
  });
  lines.push(
    '',
    arabic
      ? '**ملاحظة:** هذه قائمة تنظيمية فقط. أنشئ التبويبات من زر + بجانب «تبويبات المستند» في Google Docs.'
      : '**Note:** This is an organizational checklist. Create the tabs with the + button beside “Document tabs” in Google Docs.'
  );
  return lines.join('\n');
}

function localizedWorkspaceTitle_(definition, arabic) {
  return arabic ? definition[2] : definition[1];
}
