function AppError(code, message) {
  this.name = 'AppError';
  this.code = code;
  this.message = message;
}
AppError.prototype = Object.create(Error.prototype);

var ERROR_MESSAGES = {
  ar: {
    UNKNOWN: 'إجراء غير معروف.',
    EMPTY: 'لا يوجد نص — اكتب في المستند أو حدّد نصًا أولًا.',
    TOO_LONG: 'النص طويل جدًا — حدّد جزءًا أصغر ثم أعد المحاولة.',
    NEED_PROPOSAL: 'حضّر المقترح أولًا ثم أعد المحاولة.',
    BACKEND_NOT_CONFIGURED: 'خدمة عنوان لم تُضبط بعد.',
    BACKEND_UNAVAILABLE: 'خدمة عنوان غير متاحة مؤقتًا — أعد المحاولة.',
    BACKEND_ERROR: 'تعذّر إكمال الطلب.',
    IDENTITY_TOKEN: 'تعذّر تأكيد حساب Google — أعد تفويض الإضافة.',
    AUTH_REQUIRED: 'سجّل الدخول إلى Google للمتابعة.',
    INVALID_IDENTITY: 'يلزم حساب Google موثّق.',
    FREE_LIMIT: 'استخدمت جميع إجراءاتك المجانية. راسل support@onwan.eu — قد يتوفر المزيد دون مقابل.',
    INSUFFICIENT_CREDITS: 'رصيدك غير كافٍ لهذا الإجراء.',
    INVALID_LICENSE: 'رمز الترخيص غير صالح.',
    LICENSE_BOUND: 'هذا الترخيص مرتبط بحساب Google آخر.',
    LICENSE_INACTIVE: 'هذا الترخيص غير نشط.',
    SUSPENDED: 'تم إيقاف الوصول مؤقتًا.',
    AI_UNAVAILABLE: 'Gemini غير متاح مؤقتًا — أعد المحاولة.',
    DUPLICATE_REQUEST: 'عولج هذا الطلب من قبل.',
    RATE_LIMIT: 'طلبات كثيرة خلال وقت قصير — انتظر قليلًا ثم أعد المحاولة.',
    WRITE_FAILED: 'تم التوليد لكن تعذّرت الكتابة في المستند — اضغط «إعادة الكتابة».',
    NO_RETRY: 'لا توجد نتيجة محفوظة لإعادة كتابتها.',
    BAD_LOCALE: 'لغة الواجهة غير مدعومة.',
    BAD_LANGUAGE: 'لغة المشروع غير صالحة.',
    WORKSPACE_FAILED: 'تعذّر الوصول إلى تبويب المستند المطلوب.',
    INTERNAL: 'انقطع الاتصال — أعد المحاولة.',
  },
  en: {
    UNKNOWN: 'Unknown action.',
    EMPTY: 'There is no text. Write in the document or select text first.',
    TOO_LONG: 'The text is too long. Select a smaller section and try again.',
    NEED_PROPOSAL: 'Prepare the proposal first, then try again.',
    BACKEND_NOT_CONFIGURED: 'The Onwan service is not configured yet.',
    BACKEND_UNAVAILABLE: 'Onwan is temporarily unavailable. Please try again.',
    BACKEND_ERROR: 'The request could not be completed.',
    IDENTITY_TOKEN: 'Your Google account could not be verified. Reauthorize the add-on.',
    AUTH_REQUIRED: 'Sign in with Google to continue.',
    INVALID_IDENTITY: 'A verified Google account is required.',
    FREE_LIMIT: 'You have used all of your free actions. Email support@onwan.eu — more may be available at no charge.',
    INSUFFICIENT_CREDITS: 'You do not have enough credits for this action.',
    INVALID_LICENSE: 'The licence code is invalid.',
    LICENSE_BOUND: 'This licence is linked to another Google account.',
    LICENSE_INACTIVE: 'This licence is inactive.',
    SUSPENDED: 'Access is temporarily suspended.',
    AI_UNAVAILABLE: 'Gemini is temporarily unavailable. Please try again.',
    DUPLICATE_REQUEST: 'This request has already been processed.',
    RATE_LIMIT: 'Too many requests in a short period. Wait and try again.',
    WRITE_FAILED: 'Generation succeeded, but Docs writing failed. Select “Retry writing”.',
    NO_RETRY: 'There is no saved result to write again.',
    BAD_LOCALE: 'The interface language is not supported.',
    BAD_LANGUAGE: 'The project language is invalid.',
    WORKSPACE_FAILED: 'The requested document tab could not be accessed.',
    INTERNAL: 'The connection was interrupted. Please try again.',
  },
};

function errorMessage_(code, fallback) {
  var locale = getUiLocale_() || 'ar';
  return (ERROR_MESSAGES[locale] && ERROR_MESSAGES[locale][code]) || fallback ||
    ERROR_MESSAGES[locale].INTERNAL;
}

function humanError(err) {
  if (err && err.name === 'AppError') return errorMessage_(err.code, err.message);
  return errorMessage_('INTERNAL');
}
