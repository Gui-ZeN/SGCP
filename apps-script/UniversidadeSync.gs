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
 *      GCP_PROJECT_ID = id do projeto Firebase (ex.: project-312a1a63-…)
 *      FIRESTORE_DB   = id do banco Firestore (ex.: ai-studio-… ; omita p/ "(default)")
 *      SA_EMAIL       = e-mail da conta de serviço (…@….iam.gserviceaccount.com)
 *      SA_PRIVATE_KEY = a private key DESSA MESMA conta de serviço (com \n)
 *    IMPORTANTE: SA_EMAIL, SA_PRIVATE_KEY e o papel IAM têm que ser a MESMA conta,
 *    no MESMO projeto do Firestore (GCP_PROJECT_ID). Ela precisa do papel
 *    "Usuário do Cloud Datastore" (leitura+ESCRITA) no IAM desse projeto.
 * 2) Ajuste as constantes CONFIG abaixo (ID da planilha, aba, sede).
 * 3) Rode instalarGatilho() uma vez para agendar a sincronização de hora em hora.
 * 4) Rode sincronizarVagasUniversidade() manualmente para o primeiro espelho.
 */

const CONFIG = {
  PLANILHA_ID: 'COLE_AQUI_O_ID_DA_PLANILHA', // da URL: .../d/<ESTE_ID>/edit
  ABA: 'Página1',                            // nome da aba (se não achar, usa a primeira)
  ORIGEM: 'planilha-universidade'            // etiqueta de origem (separa Universidade + marca como somente-leitura)
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
  const planilha = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  const aba = planilha.getSheetByName(CONFIG.ABA) || planilha.getSheets()[0]; // fallback: primeira aba
  if (!aba) throw new Error('Planilha sem abas.');
  const dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];

  // normalizar_ colapsa espaços/quebras de linha (o cabeçalho "Tempo \ndo processo" tem \n)
  const cab = dados[0].map(function (h) { return normalizar_(h); });
  const col = function (linha, nome) { const i = cab.indexOf(normalizar_(nome)); return i < 0 ? '' : linha[i]; };

  const out = [];
  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const cargo = limpar_(col(linha, 'Cargo'));         // a planilha usa "Cargo" (não "Vaga")
    const solicitante = limpar_(col(linha, 'Solicitante'));
    if (!cargo || !solicitante) continue;               // ignora linhas sem cargo/solicitante

    const sedeRaw = limpar_(col(linha, 'Sede'));
    let sede = resolverSede_(sedeRaw); // converte o rótulo da planilha → nome do sistema
    if (sede === null) {
      Logger.log('Sede sem correspondencia no sistema: "' + sedeRaw + '" (linha ' + (i + 1) + ') — mantida como veio.');
      sede = sedeRaw || 'Universidade';
    }
    const solicitacao = col(linha, 'Solicitação');
    const conclusao = col(linha, 'Conclusão');
    const motivo = limpar_(col(linha, 'Motivo'));
    const substituido = limpar_(col(linha, 'Funcionário a ser substituído'));

    // Sem coluna "Código" → id estável por hash do conteúdo natural (não embaralha se reordenar).
    const codigo = hashCodigo_([cargo, sede, dataBR_(solicitacao), solicitante, substituido].join('|'));

    out.push({
      codigo: codigo,
      vaga: cargo,
      sede: sede,                                        // mantém o campus real (PE, Dom Luís, Eusébio…)
      status: normalizarStatus_(col(linha, 'Status')),
      setor: limpar_(col(linha, 'Setor')) || 'Geral',
      sexo: (function () { const s = normalizar_(col(linha, 'Sexo')); return s.indexOf('femin') >= 0 ? 'FEMININO' : s.indexOf('mascul') >= 0 ? 'MASCULINO' : 'INDIFERENTE'; })(),
      solicitacao: dataBR_(solicitacao) || dataBR_(new Date()),
      solicitante: solicitante,
      motivo: motivo,
      funcionarioSubstituido: substituido,
      etapa: limpar_(col(linha, 'Etapa')),
      aprovado: limpar_(col(linha, 'Aprovado')),
      observacoes: limpar_(col(linha, 'Observação')),   // singular na planilha
      responsavel: limpar_(col(linha, 'Responsável')) || 'RH Universidade',
      conclusao: dataBR_(conclusao),
      tempoProcesso: numero_(col(linha, 'Tempo do processo'), 0),
      categoria: 'Universidade',
      ano: anoDe_(solicitacao),
      categoriaMotivo: motivo.toLowerCase().indexOf('amplia') >= 0 || motivo.toLowerCase().indexOf('aumento') >= 0 ? 'Aumento de Quadro' : 'Substituição',
      origem: CONFIG.ORIGEM
    });
  }
  return out;
}

/** Hash estável (DJB2) → inteiro positivo, usado como código/id (uni-<código>). */
function hashCodigo_(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) & 0x7fffffff;
  return h;
}

/**
 * Conversão do rótulo de sede da planilha → NOME canônico da sede no sistema.
 * A planilha usa rótulos próprios (ex.: "PE", "Dom Luís"); o sistema espera o
 * nome (ex.: "PARQUE ECOLÓGICO", "DOM LUÍS"). Casa por NOME ou SIGLA, ignorando
 * maiúsculas/acentos/espaços. Mantenha esta tabela em sincronia com o Painel Admin.
 */
var SEDES_SISTEMA = [
  { nome: 'BENFICA', sigla: 'BN' },
  { nome: 'PARQUELANDIA 1', sigla: 'PQL 1' },
  { nome: 'SUL 3', sigla: 'SUL 3' },
  { nome: 'DOM LUÍS', sigla: 'DL' },
  { nome: 'EQUIPE D.VALERIA', sigla: 'EDV' },
  { nome: 'DIONISIO TORRES', sigla: 'DT' },
  { nome: 'PARQUE ECOLÓGICO', sigla: 'PE' },
  { nome: 'SUL 2', sigla: 'SUL 2' },
  { nome: 'SUL', sigla: 'SUL 1' },
  { nome: 'EUSEBIO', sigla: 'EUS' },
  { nome: 'PRE NUNES', sigla: 'PN' },
  { nome: 'BARAO STUADART', sigla: 'BS' },
  { nome: 'PRE JOVITA', sigla: 'PJV' },
  { nome: 'ALDEOTA', sigla: 'ALD' },
  { nome: 'SILVA PAULET', sigla: 'SP' },
  { nome: 'PARQUELANDIA 2', sigla: 'PQL 2' },
  { nome: 'PARQUELANDIA 3', sigla: 'PQL 3' },
  { nome: 'PRE SUL', sigla: 'PSUL' },
  { nome: 'Construtora', sigla: '-' }
];

function normChave_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Retorna o NOME canônico da sede, ou null se não encontrar correspondência. */
function resolverSede_(valor) {
  const n = normChave_(valor);
  if (!n) return null;
  for (let i = 0; i < SEDES_SISTEMA.length; i++) {
    const s = SEDES_SISTEMA[i];
    if (normChave_(s.nome) === n || (s.sigla !== '-' && normChave_(s.sigla) === n)) return s.nome;
  }
  return null;
}

/* ───────────────── Firestore REST ───────────────── */

function baseUrl_() {
  const props = PropertiesService.getScriptProperties();
  const pid = props.getProperty('GCP_PROJECT_ID');
  const dbId = props.getProperty('FIRESTORE_DB') || '(default)'; // suporta banco nomeado (ex.: ai-studio-...)
  return 'https://firestore.googleapis.com/v1/projects/' + pid + '/databases/' + dbId + '/documents';
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
  const email = props.getProperty('SA_EMAIL') || props.getProperty('SA_CLIENT_EMAIL');
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

function normalizar_(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
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
