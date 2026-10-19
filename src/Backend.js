var BACKEND_TIMEOUT_NOTE = 'Cloud Run';

function backendHealth_() {
  var url = getBackendUrl_();
  if (!url) throw new AppError('BACKEND_NOT_CONFIGURED');
  var response = UrlFetchApp.fetch(url + '/health', {
    method: 'get',
    muteHttpExceptions: true,
  });
  var code = response.getResponseCode();
  var data = parseBackendJson_(response.getContentText());
  if (code !== 200 || !data.ok) throw new AppError('BACKEND_UNAVAILABLE');
  return data;
}

function callOnwan_(path, method, payload) {
  var url = getBackendUrl_();
  if (!url) throw new AppError('BACKEND_NOT_CONFIGURED');
  var token = ScriptApp.getIdentityToken();
  if (!token) throw new AppError('IDENTITY_TOKEN');

  var options = {
    method: String(method || 'get').toLowerCase(),
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  };
  if (payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  var response;
  try {
    response = UrlFetchApp.fetch(url + path, options);
  } catch (error) {
    throw new AppError('BACKEND_UNAVAILABLE');
  }
  var code = response.getResponseCode();
  var data = parseBackendJson_(response.getContentText());
  if (code < 200 || code >= 300 || !data.ok) {
    throw new AppError(data.error || 'BACKEND_ERROR', data.message || '');
  }
  return data;
}

function parseBackendJson_(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

function getEntitlementState() {
  try {
    return callOnwan_('/v1/entitlement', 'get');
  } catch (err) {
    return { ok: false, error: humanError(err) };
  }
}

function activateLicense(code) {
  try {
    return callOnwan_('/v1/licenses/activate', 'post', { code: String(code || '').trim() });
  } catch (err) {
    return { ok: false, error: humanError(err) };
  }
}

function devIdentityInfo() {
  var token = ScriptApp.getIdentityToken();
  if (!token) throw new Error('No identity token. Reauthorize the script first.');
  var parts = token.split('.');
  if (parts.length !== 3) throw new Error('Unexpected identity-token format.');
  var json = Utilities.newBlob(
    Utilities.base64DecodeWebSafe(parts[1])
  ).getDataAsString();
  var payload = JSON.parse(json);
  Logger.log(
    JSON.stringify({
      audience: payload.aud,
      issuer: payload.iss,
      subjectPresent: !!payload.sub,
      emailPresent: !!payload.email,
      emailVerified: payload.email_verified,
    })
  );
}

function devAuthProbe() {
  var url = getBackendUrl_();
  if (!url) throw new Error('Backend URL is not configured.');
  var token = ScriptApp.getIdentityToken();
  if (!token) throw new Error('No identity token. Reauthorize the script first.');
  var response = UrlFetchApp.fetch(url + '/v1/entitlement', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  var data = parseBackendJson_(response.getContentText());
  Logger.log(
    JSON.stringify({
      status: response.getResponseCode(),
      ok: !!data.ok,
      error: data.error || null,
    })
  );
}
