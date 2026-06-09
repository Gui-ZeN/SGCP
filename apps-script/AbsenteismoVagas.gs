/**
 * SGCP — Leitura da coleção `vagas` do Firestore via Service Account.
 * Para o dashboard externo de Absenteísmo (projeto Google Apps Script).
 *
 * Substitui a leitura anônima via apiKey web (que só funcionava porque as
 * Firestore Rules eram públicas). Autentica com OAuth 2.0 (JWT Bearer) usando
 * uma service account com papel read-only (Cloud Datastore Viewer). Como a
 * service account usa IAM, ela continua lendo o Firestore mesmo depois que a
 * regra de leitura de `vagas` for fechada (allow read: if isAppUser()).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  SETUP (uma vez)
 * ─────────────────────────────────────────────────────────────────────────
 *  1. GCP Console → IAM & Admin → Service Accounts → "Create service account"
 *     (ex.: absenteismo-reader).
 *  2. Conceder o papel "Cloud Datastore Viewer" (roles/datastore.viewer)
 *     — somente leitura.
 *  3. Na service account → Keys → "Add key" → JSON. Baixe o arquivo.
 *  4. Neste projeto Apps Script: ⚙ Project Settings → Script Properties →
 *     adicione (Add script property):
 *        SA_EMAIL        →  campo "client_email" do JSON
 *        SA_PRIVATE_KEY  →  campo "private_key" do JSON (cole como veio,
 *                           com os "\n" literais — o código converte)
 *        GCP_PROJECT_ID  →  id do projeto Firebase
 *        FIRESTORE_DB    →  (default)   ou   ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47
 *  5. Rode `testarLeituraVagas` uma vez e autorize os escopos solicitados.
 *
 *  Escopos necessários (Apps Script pede na 1ª execução):
 *    https://www.googleapis.com/auth/script.external_request   (UrlFetchApp)
 */

var SGCP_VAGAS = (function () {
  var TOKEN_CACHE_KEY = 'sgcp_fs_token';
  var TOKEN_TTL_SECONDS = 3300; // 55 min (token vale 1h)

  function prop_(name) {
    var v = PropertiesService.getScriptProperties().getProperty(name);
    if (!v) throw new Error('Script Property ausente: ' + name);
    return v;
  }

  function base64UrlNoPad_(input) {
    // Aceita string ou byte[]; remove o padding "=" exigido pelo JWT.
    return Utilities.base64EncodeWebSafe(input).replace(/=+$/, '');
  }

  /** Gera (com cache) um access token OAuth 2.0 para o Firestore. */
  function getAccessToken_() {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(TOKEN_CACHE_KEY);
    if (cached) return cached;

    var email = prop_('SA_EMAIL');
    var key = prop_('SA_PRIVATE_KEY').replace(/\\n/g, '\n');
    var now = Math.floor(Date.now() / 1000);

    var header = { alg: 'RS256', typ: 'JWT' };
    var claim = {
      iss: email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    };

    var toSign = base64UrlNoPad_(JSON.stringify(header)) + '.' +
                 base64UrlNoPad_(JSON.stringify(claim));
    var signature = Utilities.computeRsaSha256Signature(toSign, key);
    var jwt = toSign + '.' + base64UrlNoPad_(signature);

    var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      muteHttpExceptions: true,
      payload: {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      }
    });

    if (resp.getResponseCode() !== 200) {
      throw new Error('Falha ao obter token OAuth: ' + resp.getContentText());
    }
    var token = JSON.parse(resp.getContentText()).access_token;
    cache.put(TOKEN_CACHE_KEY, token, TOKEN_TTL_SECONDS);
    return token;
  }

  /** Converte um valor no formato REST do Firestore para um valor JS simples. */
  function parseValue_(v) {
    if (v == null) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) {
      return (v.arrayValue.values || []).map(parseValue_);
    }
    if ('mapValue' in v) {
      return parseFields_(v.mapValue.fields || {});
    }
    return null;
  }

  function parseFields_(fields) {
    var out = {};
    Object.keys(fields).forEach(function (k) {
      out[k] = parseValue_(fields[k]);
    });
    return out;
  }

  /** Extrai o ID do documento do campo `name` (último segmento do caminho). */
  function docId_(name) {
    var parts = String(name).split('/');
    return parts[parts.length - 1];
  }

  /**
   * Lê TODAS as vagas (com paginação) e devolve uma lista de objetos planos
   * no mesmo formato usado pelo SGCP: { id, codigo, vaga, sede, status, ... }.
   */
  function listVagas() {
    var projectId = prop_('GCP_PROJECT_ID');
    var dbId = prop_('FIRESTORE_DB');
    var token = getAccessToken_();
    var base = 'https://firestore.googleapis.com/v1/projects/' + projectId +
               '/databases/' + encodeURIComponent(dbId) + '/documents/vagas';

    var vagas = [];
    var pageToken = '';
    do {
      var url = base + '?pageSize=300' +
                (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
      var resp = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + token }
      });
      if (resp.getResponseCode() !== 200) {
        throw new Error('Falha ao ler vagas (' + resp.getResponseCode() + '): ' +
                        resp.getContentText());
      }
      var body = JSON.parse(resp.getContentText());
      (body.documents || []).forEach(function (d) {
        var obj = parseFields_(d.fields || {});
        obj.id = docId_(d.name);
        vagas.push(obj);
      });
      pageToken = body.nextPageToken || '';
    } while (pageToken);

    return vagas;
  }

  return { listVagas: listVagas };
})();

/** Função pública para o restante do dashboard de Absenteísmo consumir. */
function fetchVagas() {
  return SGCP_VAGAS.listVagas();
}

/** Rode isto uma vez para autorizar escopos e validar o setup. */
function testarLeituraVagas() {
  var vagas = SGCP_VAGAS.listVagas();
  Logger.log('Total de vagas lidas: ' + vagas.length);
  if (vagas.length) Logger.log('Exemplo: ' + JSON.stringify(vagas[0]));
}
