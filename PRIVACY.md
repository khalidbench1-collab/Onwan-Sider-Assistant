# Onwan Privacy Policy / سياسة خصوصية عنوان

> **INTERNAL TRANSLATION/REFERENCE — NOT PUBLISHED.** The public privacy notice is the German
> `DATENSCHUTZ.md`, served at `https://onwan.eu/datenschutz` and registered as the privacy policy URL
> on the OAuth consent screen. This file mirrors it in English and Arabic. **If you change one, change
> both** — a contradiction between them is a verification risk. Sections 5, 6, and 8 were rewritten on
> 2026-08-13 to answer Google Trust & Safety's findings and must stay aligned with the German text.

**Last updated:** 2026-08-15
**Public counterpart:** `DATENSCHUTZ.md`, effective 15 August 2026
**Service:** عنوان / Onwan
**Operator and data controller:** Khalid Bencherif, freelance journalist / Onwan
**Contact:** [support@onwan.eu](mailto:support@onwan.eu)
**Address:** Berlin, Germany — full postal address in the Impressum (`IMPRESSUM.md`, published at
`https://onwan.eu/impressum`)

## English

### 1. What Onwan is

Onwan is an editorial assistant for journalists inside Google Docs. It helps organize reporting
projects and generate or review editorial material using a managed Google Gemini service. This policy
applies to the Onwan website, pilot, Google Docs add-on, and support.

### 2. Information we process

- **Account and access:** Google account email, a pseudonymous user identifier, interface preference,
  licence status, plan, credit balance, and activation dates.
- **Editorial requests:** selected text or, when nothing is selected, content of the active document
  tab, action type, selected project language, and the generated response.
- **Operational data:** request ID, timestamps, model name, token/credit counts, latency, success or
  error code, and coarse usage totals.
- **Technical/security data:** hosting and security layers necessarily receive connection data such as
  an IP address, browser/user-agent details, and timestamps. Onwan's application logs are designed to
  minimize this data and exclude document content; final Cloud configuration must be verified.
- **Support and pilot records:** messages, voluntarily supplied feedback, and consent choices.

### 3. How editorial content is handled

Onwan requests the narrow Google permission
`https://www.googleapis.com/auth/documents.currentonly`. Access is technically limited to the document
the user currently has open, including all of that document's tabs. Onwan cannot open, list, or search
any other file in Google Drive.

An optional style profile — tone, phrasings to avoid, sample passages — is text the user types into
settings. It is stored in Google Apps Script's per-user properties until the user changes or clears it,
and is sent only with style-dependent actions.

Editorial text is sent to the Onwan backend and Google Gemini only to perform the requested action.
The launch design does **not** store document text, prompts, or generated editorial content in Onwan's
server logs or database after the response is returned. Google Apps Script can hold the last proposal
or an output awaiting a failed document write in its per-user cache for up to six hours, preventing a
second AI charge. Google Docs stores content under the user's Google account. Users must not submit
material they lack authority to process.

Before launch, this statement must be verified with planted-marker logging tests and the final Google
Cloud/Gemini data settings. If the implementation differs, this policy must be corrected first.

### 4. Why we process information

We process information to provide and secure the service, authenticate users, enforce usage limits,
answer support requests, prevent abuse, improve reliability, comply with law, and—with separate
permission—use a testimonial in marketing.

### 5. With whom we share, transfer, or disclose Google user data

We do **not** sell personal information, do not pass it to data brokers, and do not use document
content or any other Google user data for advertising, profiling, or resale.

Google user data is transferred only to the following processors and only for the purposes named:

| Recipient | Google user data transferred | Purpose |
|---|---|---|
| **Google Cloud** — Cloud Run, Firestore, Secret Manager, Cloud Logging (project `onwan-production`) | Pseudonymous user hashes, licence, credit, and operational data; document content only transiently while a request is served | Running the service, authentication, enforcing entitlements |
| **Google Cloud Vertex AI (Gemini)** | The text selected for the action or the content of the active document tab, project language, action type, and the style profile if set | Performing the editorial action the user requested |
| **Google Workspace / Google Docs, Apps Script** | The document the user has open and the per-user add-on settings | Showing the sidebar and writing results into the document |
| **Google (Gmail)** | Support correspondence, as supplied by the user | Answering support requests |

Beyond these, Google user data is disclosed only on the user's explicit instruction; where technically
necessary to prevent abuse, fraud, or security incidents; in a lawful business transfer; or where
legally or judicially required.

Under the Google Cloud terms, Google does not use inputs and outputs sent through Vertex AI to train
its general models; processing is carried out under the Google Cloud Data Processing Addendum. Onwan
does not read document content — support cases are handled solely from what the user tells us.
Customer contacts are not placed in the public XPRIZE submission; they are provided to judges only if
requested and only after the customer has consented.

Onwan's use and transfer of information received from Google APIs complies with the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including its Limited Use requirements.

### 6. No use of Google Workspace data to train AI/ML models

Onwan does **not** use user data obtained through Google Workspace APIs — in particular document
content, prompts, and generated output — to develop, improve, or train generalized or
non-personalized artificial-intelligence or machine-learning models. Onwan trains no models of its
own and transfers no Google Workspace data to third parties for training purposes.

Text submitted for an action is used solely to produce the response the user requested, within that
same request. There is no human review of document content for training or quality purposes.

### 7. Retention

- Editorial content in Onwan server storage: no post-response retention under the launch design.
- Operational events without content: proposed 90 days, to be verified in production.
- Support and pilot feedback: proposed 12 months after last contact.
- Consent records: while the related evidence or testimonial is used, plus a reasonable audit period.

Backups and provider systems may take additional time to delete data. Final periods must be confirmed
before publication.

### 8. Data protection mechanisms

Onwan protects personal data — including the especially sensitive journalistic document content and
Google account data — with the following **implemented** measures:

- **Encrypted transport.** Every connection between the add-on, the Onwan backend, and Google Cloud
  runs over TLS (HTTPS). The website additionally sends HSTS.
- **Encrypted storage.** All data held in Google Cloud (Firestore, Secret Manager, Cloud Logging) is
  encrypted at rest by Google by default.
- **Minimization of sensitive content.** Document text, prompts, style profile, and generated output
  are not stored in the Onwan database.
- **Pseudonymization.** The Google account identifier and the email address are hashed with SHA-256
  and a salt held server-side in Google Secret Manager. Only those hashes are stored; the plaintext
  email address is not kept in the database.
- **Log redaction.** Logging replaces a defined set of fields — document text, idea text, style
  profile, prompt, generated output, email address, token, and Authorization header — with
  `[REDACTED]` before writing. An automated test covers this redaction.
- **Authentication.** Every backend request requires a Google-issued ID token, verified server-side
  against this project's pinned OAuth client identifier. Unverified Google accounts are rejected.
- **Access restriction.** The database is reachable only through the backend's service account.
  Direct access from the browser or from Apps Script is denied outright by security rules.
- **Secret management.** The hash salt lives in Google Secret Manager and is mounted only at runtime.
  No AI or payment key exists in the add-on or in the user's browser.
- **Minimum scope.** Onwan requests `documents.currentonly` and therefore cannot technically read any
  other file in Google Drive.
- **Incident handling.** Security incidents posing a risk to data subjects are investigated and, where
  GDPR Articles 33 and 34 require it, reported to the supervisory authority and to those affected.

No system is perfectly secure.

### 8a. Storage locations and international transfers

The Onwan backend (Cloud Run) and the database (Firestore) run in the Google Cloud region
`europe-southwest1` (Madrid, Spain), so that data stays in the European Union. The Gemini models are
called through the **global** Vertex AI endpoint, so text submitted for an action may be processed
outside the EU/EEA. Google's processing rests on the Google Cloud Data Processing Addendum, which
bases third-country transfers on the EU Standard Contractual Clauses with supplementary measures.

### 9. Choices and rights

Depending on local law, users may request access, correction, deletion, restriction, objection, or
portability, and may withdraw optional consent. Requests go to [support@onwan.eu](mailto:support@onwan.eu). Users can revoke Google access from their Google
Account security settings and can stop using or uninstall the add-on.

### 10. Cookies and related technologies

The launch design does not use advertising or behavioural tracking cookies. No third-party analytics
or advertising services are embedded. The website does not require cookies to be delivered. Google can
use necessary security/authentication/payment
technologies on its own pages; these are governed by the respective provider's privacy notices.

### 11. Journalistic use and GDPR

Onwan supports journalism, but the commercial platform does not claim a blanket Article 85 GDPR
exemption merely because its operator or users are journalists. Any journalistic exemption or source
protection must be assessed for the user's specific processing and publication. Users should avoid
submitting protected source identities unless strictly necessary and legally appropriate.

### 12. Complaints, international use, children, and changes

Users have the right to complain to a competent data-protection supervisory authority. In Berlin this
is the [Berliner Beauftragte für Datenschutz und Informationsfreiheit](https://www.datenschutz-berlin.de/).

Providers may process data outside the user's country. Onwan is intended only for adults and is not
directed to children. Material changes will be posted with a new effective date and, where required,
communicated directly.

## العربية

### 1. ما هي خدمة عنوان؟

عنوان مساعد تحريري للصحفيين داخل مستندات Google. يساعد على تنظيم المشاريع الصحفية وإنتاج المواد
التحريرية أو مراجعتها عبر خدمة مُدارة تستخدم Gemini من Google. تشمل هذه السياسة الموقع والنسخة
التجريبية وإضافة مستندات Google والدعم.

### 2. ما البيانات التي نعالجها؟

- **الحساب والوصول:** بريد حساب Google، ومعرّف مستخدم مستعار، ولغة الواجهة، وحالة الترخيص والخطة
  والرصيد وتواريخ التفعيل.
- **الطلبات التحريرية:** النص الذي يرسله المستخدم بإرادته إلى أداة في عنوان، ونوع الأداة، ولغة
  المشروع، والنتيجة المولّدة.
- **بيانات التشغيل:** معرّف الطلب، والوقت، واسم النموذج، وعدد الرموز أو الأرصدة، ومدة المعالجة،
  وحالة النجاح أو رمز الخطأ، وإجماليات الاستخدام.
- **البيانات التقنية والأمنية:** تستقبل طبقات الاستضافة والأمان بالضرورة بيانات اتصال مثل عنوان IP
  ونوع المتصفح ووقت الطلب. يهدف سجل عنوان إلى تقليلها وعدم تسجيل محتوى المستند، ويجب التحقق من
  إعدادات Cloud النهائية.
- **الدعم والتجربة:** الرسائل والملاحظات المقدمة طوعاً وخيارات الموافقة.

### 3. كيف نتعامل مع المحتوى الصحفي؟

يطلب عنوان صلاحية Google المحدودة
`https://www.googleapis.com/auth/documents.currentonly`. بذلك يقتصر الوصول تقنيًا على المستند المفتوح
حاليًا أمام المستخدم، بما في ذلك جميع تبويبات هذا المستند. لا يستطيع عنوان فتح أي ملف آخر في Google
Drive أو إدراجه أو البحث فيه.

ملف الأسلوب اختياري: نص يكتبه المستخدم بنفسه (النبرة، ما يجب تجنّبه، مقاطع نموذجية). يُحفظ في إعدادات
Google Apps Script الخاصة بالمستخدم إلى أن يغيّره أو يمسحه، ولا يُرسل إلا مع الإجراءات المرتبطة
بالأسلوب.

يُرسل النص التحريري إلى خادم عنوان وGemini فقط لتنفيذ الطلب الذي اختاره المستخدم. تصميم الإطلاق لا
يخزن نصوص المستندات أو الطلبات أو النتائج التحريرية في سجلات الخادم أو قاعدة بيانات عنوان بعد إعادة
النتيجة. يبقى محتوى مستند Google في حساب المستخدم. يجب ألا يرسل المستخدم مادة لا يملك حق معالجتها.

يجب التحقق من هذا الوعد قبل الإطلاق عبر اختبارات السجلات وإعدادات Google Cloud وGemini النهائية. إذا
اختلف التنفيذ الفعلي، يجب تصحيح السياسة قبل النشر.

### 4. لماذا نعالج البيانات؟

لتقديم الخدمة وحمايتها، والتحقق من المستخدم، وتطبيق حدود الخطط، وتقديم الدعم،
ومنع الإساءة، وتحسين الاعتمادية، والامتثال للقانون. لا نستخدم شهادة عميل في التسويق إلا بموافقة
منفصلة.

### 5. مع من نشارك بيانات مستخدم Google أو ننقلها أو نفصح عنها

لا نبيع البيانات الشخصية، ولا نمررها إلى وسطاء بيانات، ولا نستخدم محتوى المستندات ولا أي بيانات
أخرى لمستخدم Google في الإعلانات أو التصنيف السلوكي أو إعادة البيع.

تُنقل بيانات مستخدم Google حصراً إلى الجهات المعالِجة التالية وللأغراض المذكورة وحدها:

| الجهة المستقبِلة | بيانات مستخدم Google المنقولة | الغرض |
|---|---|---|
| **Google Cloud** — Cloud Run وFirestore وSecret Manager وCloud Logging (مشروع `onwan-production`) | بصمات مستخدم مستعارة، وبيانات الترخيص والرصيد والتشغيل؛ ومحتوى المستند أثناء تنفيذ الطلب فقط | تشغيل الخدمة والتحقق من الهوية وتطبيق حدود الاستخدام |
| **Google Cloud Vertex AI (Gemini)** | النص المحدد للإجراء أو محتوى تبويب المستند النشط، ولغة المشروع، ونوع الإجراء، وملف الأسلوب إن وُجد | تنفيذ الإجراء التحريري الذي طلبه المستخدم |
| **Google Workspace / مستندات Google وApps Script** | المستند المفتوح أمام المستخدم وإعدادات الإضافة الخاصة به | عرض الشريط الجانبي وكتابة النتائج في المستند |
| **Google (Gmail)** | مراسلات الدعم بالقدر الذي يرسله المستخدم بنفسه | الرد على طلبات الدعم |

وفيما عدا ذلك، لا يُفصح عن بيانات مستخدم Google إلا بتوجيه صريح من المستخدم، أو عند الضرورة التقنية
لمنع الإساءة أو الاحتيال أو الحوادث الأمنية، أو في انتقال قانوني للأعمال، أو عند الإلزام القانوني
أو القضائي.

ووفق شروط Google Cloud، لا تستخدم Google المدخلات والمخرجات المرسلة عبر Vertex AI لتدريب نماذجها
العامة؛ وتجري المعالجة بموجب ملحق معالجة البيانات الخاص بـ Google Cloud. ولا يطّلع عنوان على محتوى
المستندات — إذ تُعالَج حالات الدعم استناداً إلى ما يذكره المستخدم فقط. ولا ننشر بيانات اتصال العملاء
في ملف XPRIZE العام؛ ولا نقدمها للمحكّمين عند الطلب إلا بعد موافقة العميل.

يلتزم استخدام عنوان لبيانات Google ونقلها بسياسة بيانات المستخدم لخدمات Google API، بما في ذلك
متطلبات الاستخدام المحدود.

### 6. عدم استخدام بيانات Google Workspace في تدريب نماذج الذكاء الاصطناعي

لا يستخدم عنوان أي بيانات مستخدم يحصل عليها عبر واجهات Google Workspace — وبخاصة محتوى المستندات
والطلبات والمخرجات المولّدة — لتطوير أو تحسين أو تدريب نماذج ذكاء اصطناعي أو تعلّم آلي معمّمة أو غير
مخصّصة. ولا يدرّب عنوان نماذج خاصة به، ولا ينقل بيانات Google Workspace إلى أي طرف ثالث لأغراض
التدريب.

يُستخدم النص المرسل لإجراء ما لغرض واحد هو إنتاج الاستجابة المطلوبة ضمن الطلب نفسه. ولا تجري أي
مراجعة بشرية لمحتوى المستندات لأغراض التدريب أو الجودة.

### 7. مدة الاحتفاظ

- المحتوى التحريري في خوادم عنوان: لا احتفاظ بعد إعادة النتيجة وفق تصميم الإطلاق.
- أحداث التشغيل من دون محتوى: 90 يوماً مقترحة، ويجب التحقق منها في الإنتاج.
- رسائل الدعم وملاحظات التجربة: 12 شهراً مقترحة بعد آخر تواصل.
- سجلات الموافقة: طوال استخدام الدليل أو الشهادة، مع مدة تدقيق معقولة.

يجب تأكيد هذه المدد قبل النشر، وقد تحتاج النسخ الاحتياطية وأنظمة المزودين وقتاً إضافياً للحذف.

### 8. آليات حماية البيانات

يحمي عنوان البيانات الشخصية — بما فيها محتوى المستندات الصحفية شديد الحساسية وبيانات حساب Google —
بالتدابير **المطبَّقة** التالية:

- **نقل مشفَّر.** تمر كل الاتصالات بين الإضافة وخادم عنوان وGoogle Cloud عبر TLS حصراً،
  ويرسل الموقع ترويسة HSTS.
- **تخزين مشفَّر.** تُشفَّر جميع البيانات المحفوظة في Google Cloud (Firestore وSecret Manager
  وCloud Logging) في حالة السكون افتراضياً من جانب Google.
- **تقليل المحتوى الحساس.** لا تُخزَّن نصوص المستندات ولا الطلبات ولا ملف الأسلوب ولا المخرجات
  المولّدة في قاعدة بيانات عنوان.
- **إخفاء الهوية.** يُشتق من معرّف حساب Google والبريد الإلكتروني بصمة SHA-256 مع ملح سري يُحفظ في
  Secret Manager على الخادم وحده. ولا تُخزَّن في قاعدة البيانات إلا هذه البصمات؛ ولا يُحفظ البريد
  الإلكتروني بنصه الصريح.
- **حجب السجلات.** تستبدل آلية التسجيل حقولاً محددة — نص المستند، ونص الفكرة، وملف الأسلوب، والطلب،
  والمخرجات المولّدة، والبريد الإلكتروني، والرمز، وترويسة Authorization — بالقيمة `[REDACTED]` قبل
  الكتابة، ويغطي هذا الحجب اختبار آلي.
- **التحقق من الهوية.** يتطلب كل طلب إلى الخادم رمز هوية صادراً عن Google، ويُتحقق منه على الخادم
  مقابل معرّف عميل OAuth المثبَّت لهذا المشروع. وتُرفض حسابات Google غير المؤكدة.
- **تقييد الوصول.** لا يمكن بلوغ قاعدة البيانات إلا عبر حساب خدمة الخادم، ويُمنع الوصول المباشر من
  المتصفح أو من Apps Script منعاً تاماً بقواعد الأمان.
- **إدارة الأسرار.** يُحفظ الملح السري في Secret Manager ولا يُربط
  إلا وقت التشغيل. ولا يوجد أي مفتاح للذكاء الاصطناعي أو الدفع داخل الإضافة أو متصفح المستخدم.
- **أقل صلاحية ممكنة.** يطلب عنوان صلاحية `documents.currentonly` ولذلك لا يستطيع تقنياً قراءة أي
  ملف آخر في Google Drive.
- **معالجة الحوادث.** تُحقَّق الحوادث الأمنية التي تشكل خطراً على الأشخاص، ويُبلَّغ عنها لسلطة
  الرقابة وللمتأثرين متى فرضت المادتان 33 و34 من GDPR ذلك.

لا يوجد نظام آمن بصورة مطلقة.

### 8أ. مواقع التخزين والنقل الدولي

يعمل خادم عنوان (Cloud Run) وقاعدة البيانات (Firestore) في منطقة Google Cloud
`europe-southwest1` (مدريد، إسبانيا)، فتبقى هذه البيانات داخل الاتحاد الأوروبي. أما نماذج Gemini
فتُستدعى عبر نقطة Vertex AI **العالمية**، ولذلك قد تجري معالجة النص المرسل لإجراء ما خارج الاتحاد
الأوروبي أو المنطقة الاقتصادية الأوروبية. تستند معالجة Google إلى ملحق معالجة البيانات الخاص بـ
Google Cloud الذي يعتمد في النقل إلى دول ثالثة على البنود التعاقدية النموذجية للاتحاد الأوروبي مع
تدابير تكميلية.

### 9. اختيارات المستخدم وحقوقه

بحسب القانون المحلي، يمكن للمستخدم طلب الوصول أو التصحيح أو الحذف أو التقييد أو الاعتراض أو نقل
البيانات، وسحب الموافقات الاختيارية. تُرسل الطلبات إلى
[support@onwan.eu](mailto:support@onwan.eu). ويمكن للمستخدم إلغاء وصول Google من إعدادات أمان حسابه وإيقاف استخدام
الإضافة أو حذفها.

### 10. ملفات الارتباط

لا يستخدم تصميم الإطلاق ملفات ارتباط للإعلانات أو التتبع السلوكي. ولا تُضمَّن أي خدمات تحليلات أو
إعلانات من طرف ثالث. لا يحتاج الموقع إلى ملفات ارتباط لتقديم محتواه. وقد تستخدم Google تقنيات ضرورية
للأمان وتسجيل الدخول والدفع على صفحاتها؛ وتخضع هذه
التقنيات لإشعارات الخصوصية الخاصة بكل مزود.

### 11. الاستخدام الصحفي واللائحة العامة لحماية البيانات

يدعم عنوان العمل الصحفي، لكنه لا يدعي إعفاءً شاملاً بموجب المادة 85 من GDPR لمجرد أن المشغل أو
المستخدم صحفي. يجب تقييم أي إعفاء صحفي أو حماية للمصدر في سياق المعالجة والنشر المحددين. يُنصح بعدم
إرسال هوية مصدر محمي إلا عند الضرورة القانونية والمهنية.

### 12. الشكاوى والمعالجة الدولية والقاصرون والتعديلات

يمكن تقديم شكوى إلى سلطة حماية البيانات المختصة. سلطة برلين هي
[Berliner Beauftragte für Datenschutz und Informationsfreiheit](https://www.datenschutz-berlin.de/).

قد يعالج المزودون البيانات خارج بلد المستخدم. الخدمة مخصصة للبالغين وليست موجهة للأطفال. ننشر
التغييرات الجوهرية بتاريخ سريان جديد ونبلغ المستخدم مباشرة متى تطلب القانون ذلك.
