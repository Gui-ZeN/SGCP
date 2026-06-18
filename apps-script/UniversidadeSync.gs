/**
 * SGCP — Sincronização da planilha de Vagas da UNIVERSIDADE → Firestore.
 *
 * O RH da Universidade trabalha SÓ na planilha. Este robô (Google Apps Script)
 * lê a planilha de hora em hora e espelha as vagas no Firestore do SGCP, numa
 * região separada ("Universidade"), sem misturar com as vagas do Colégio.
 *
 * Características (decididas com o time):
 *  - Frequência: gatilho de tempo de 1 em 1 hora (ver instalarGatilho()).
 *  - Espelho fiel: vaga que sai da planilha é REMOVIDA do SGCP.
 *  - Somente leitura no SGCP: cada vaga recebe origem = 'planilha-universidade'.
 *  - Sem duplicar: o id do documento é estável (uni-<código>), então re-sincronizar
 *    ATUALIZA em vez de criar de novo.
 *
 * ───────────────── CONFIGURAÇÃO (faça uma vez) ─────────────────
 * 1) Propriedades do Script (Projeto ▸ Configurações ▸ Propriedades do script):
 *      GCP_PROJECT_ID   = id do projeto Firebase (ex.: project-312a1a63)
 *      SA_CLIENT_EMAIL  = e-mail da conta de serviço (…@….iam.gserviceaccount.com)
 *      SA_PRIVATE_KEY   = a private key da conta de serviço (com as quebras de linha)
 *    A conta de serviço precisa do papel "Cloud Datastore User" (leitura+ESCRITA)
 *    no IAM do projeto. (A de Absenteísmo hoje só tem Viewer = leitura.)
 * 2) Ajuste as constantes CONFIG abaixo (ID da planilha, aba, sede).
 * 3) Rode instalarGatilho() uma vez para agendar a sincronização de hora em hora.
 * 4) Rode sincronizarVagasUniversidade() manualmente para o primeiro espelho.
 */

const CONFIG = {
  PLANILHA_ID: 'COLE_AQUI_O_ID_DA_PLANILHA', // da URL: .../d/<ESTE_ID>/edit
  ABA: 'Controle de Vagas',                  // mesma aba do import do SGCP
  SEDE_UNIVERSIDADE: 'Universidade',         // sede que pertence à região "Universidade" (cadastre no Painel Admin)
  ORIGEM: 'planilha-universidade'            // etiqueta de origem (separa + marca como somente-leitura)
};

/** Ponto de entrada — chamado pelo gatilho de hora em hora. */
function sincronizarVagasUniversidade() {
  const linhas = lerLinhasDaPlanilha_();
  if (!linhas.length) {
    // Guarda de segurança: planilha vazia / erro de leitura NÃO apaga tudo.
    Logger.log('Nenhuma linha válida encontrada. Sincronização abortada (proteção anti-exclusão em massa).');
    return;
  }

  const token = obterTokenAcesso_();
  const codigosNaPlanilha = {};

  linhas.forEach(function (vaga) {
    codigosNaPlanilha[vaga.codigo] = true;
    upsertVaga_(token, vaga);
  });

  // Espelho fiel: remove do SGCP as vagas de origem=planilha que sumiram da planilha.
  const existentes = listarCodigosExistentes_(token); // [{codigo, docId}]
  existentes.forEach(function (e) {
    if (!codigosNaPlanilha[e.codigo]) excluirDoc_(token, e.docId);
  });

  Logger.log('Sincronizado: ' + linhas.length + ' vaga(s) da planilha; ' +
             existentes.filter(function (e) { return !codigosNaPlanilha[e.codigo]; }).length + ' removida(s).');
}

/** Agenda a sincronização de hora em hora (rode UMA vez). */
function instalarGatilho() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarVagasUniversidade') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizarVagasUniversidade').timeBased().everyHours(1).create();
  Logger.log('Gatilho de 1h instalado.');
}

/* ───────────────── Leitura da planilha ───────────────── */

function lerLinhasDaPlanilha_() {
  const aba = SpreadsheetApp.openById(CONFIG.PLANILHA_ID).getSheetByName(CONFIG.ABA);
  if (!aba) throw new Error('Aba não encontrada: ' + CONFIG.ABA);
  const dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];

  const cab = dados[0].map(function (h) { return normalizar_(h); });
  const col = function (linha, nome) { const i = cab.indexOf(normalizar_(nome)); return i < 0 ? '' : linha[i]; };

  const out = [];
  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const vaga = limpar_(col(linha, 'Vaga'));
    const solicitante = limpar_(col(linha, 'Solicitante'));
    if (!vaga || !solicitante) continue; // ignora linhas sem cargo/solicitante (igual ao import)

    const solicitacao = col(linha, 'Solicitação');
    const conclusao = col(linha, 'Conclusão');
    const motivo = limpar_(col(linha, 'Motivo'));

    out.push({
      codigo: Math.trunc(numero_(col(linha, 'Código'), 1000 + i)),
      vaga: vaga,
      sede: CONFIG.SEDE_UNIVERSIDADE,                 // força a sede da Universidade (garante a separação por região)
      status: normalizarStatus_(col(linha, 'Status')),
      setor: limpar_(col(linha, 'Setor')) || 'Geral',
      solicitacao: dataBR_(solicitacao) || dataBR_(new Date()),
      solicitante: solicitante,
      motivo: motivo,
      funcionarioSubstituido: limpar_(col(linha, 'Funcionário a ser substituído')),
      aprovado: limpar_(col(linha, 'Aprovado')),
      observacoes: limpar_(col(linha, 'Observações')),
      responsavel: limpar_(col(linha, 'Responsável')) || 'RH Universidade',
      conclusao: dataBR_(conclusao),
      tempoProcesso: numero_(col(linha, 'Tempo do processo'), 0),
      categoria: 'Universidade',
      ano: anoDe_(solicitacao),
      categoriaMotivo: motivo.toLowerCase().indexOf('aumento') >= 0 ? 'Aumento de Quadro' : 'Substituição',
      origem: CONFIG.ORIGEM
    });
  }
  return out;
}

/* ───────────────── Firestore REST ───────────────── */

function baseUrl_() {
  const pid = PropertiesService.getScriptProperties().getProperty('GCP_PROJECT_ID');
  return 'https://firestore.googleapis.com/v1/projects/' + pid + '/databases/(default)/documents';
}

function upsertVaga_(token, vaga) {
  const docId = 'uni-' + vaga.codigo;
  const url = baseUrl_() + '/vagas/' + docId;
  const fields = {};
  Object.keys(vaga).forEach(function (k) {
    const enc = encodarValor_(vaga[k]);
    if (enc) fields[k] = enc;
  });
  const resp = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    Logger.log('Erro upsert ' + docId + ': ' + resp.getResponseCode() + ' ' + resp.getContentText());
  }
}

function listarCodigosExistentes_(token) {
  const url = baseUrl_() + ':runQuery';
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'vagas' }],
      where: {
        fieldFilter: { field: { fieldPath: 'origem' }, op: 'EQUAL', value: { stringValue: CONFIG.ORIGEM } }
      }
    }
  };
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(query),
    muteHttpExceptions: true
  });
  const rows = JSON.parse(resp.getContentText());
  const out = [];
  (rows || []).forEach(function (r) {
    if (!r.document) return;
    const nome = r.document.name;                 // .../documents/vagas/uni-123
    const docId = nome.substring(nome.lastIndexOf('/') + 1);
    const codigoField = r.document.fields && r.document.fields.codigo;
    const codigo = codigoField ? parseInt(codigoField.integerValue || codigoField.doubleValue, 10) : NaN;
    out.push({ codigo: codigo, docId: docId });
  });
  return out;
}

function excluirDoc_(token, docId) {
  const resp = UrlFetchApp.fetch(baseUrl_() + '/vagas/' + docId, {
    method: 'delete',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) Logger.log('Erro delete ' + docId + ': ' + resp.getContentText());
}

function encodarValor_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  return { stringValue: String(v) };
}

/* ───────────────── OAuth via conta de serviço (JWT RS256) ───────────────── */

function obterTokenAcesso_() {
  const props = PropertiesService.getScriptProperties();
  const email = props.getProperty('SA_CLIENT_EMAIL');
  const key = (props.getProperty('SA_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  const header = base64url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url_(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const assinatura = base64url_(Utilities.computeRsaSha256Signature(header + '.' + claim, key));
  const jwt = header + '.' + claim + '.' + assinatura;

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions: true
  });
  const json = JSON.parse(resp.getContentText());
  if (!json.access_token) throw new Error('Falha ao obter token: ' + resp.getContentText());
  return json.access_token;
}

function base64url_(input) {
  return Utilities.base64EncodeWebSafe(input).replace(/=+$/, '');
}

/* ───────────────── helpers de formatação ───────────────── */

function normalizar_(s) { return String(s || '').trim().toLowerCase(); }
function limpar_(s) { return String(s == null ? '' : s).trim(); }
function numero_(v, padrao) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? (padrao || 0) : n; }
function anoDe_(v) { const d = (v instanceof Date) ? v : new Date(v); return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear(); }

function dataBR_(v) {
  if (!v) return '';
  const d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  const dd = ('0' + d.getDate()).slice(-2);
  const mm = ('0' + (d.getMonth() + 1)).slice(-2);
  return dd + '/' + mm + '/' + d.getFullYear();
}

function normalizarStatus_(v) {
  const s = normalizar_(v);
  if (s.indexOf('fechad') >= 0 || s.indexOf('conclu') >= 0) return 'FECHADA';
  if (s.indexOf('paus') >= 0) return 'PAUSADA';
  if (s.indexOf('suspens') >= 0) return 'SUSPENSA';
  if (s.indexOf('document') >= 0 || s.indexOf('admiss') >= 0) return 'DOCUMENTAÇÃO';
  if (s.indexOf('reabert') >= 0) return 'REABERTA';
  return 'ABERTA';
}
