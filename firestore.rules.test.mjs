/**
 * Testes das Firestore Rules do SGCP.
 *
 * Pré-requisitos:
 *   npm i -D @firebase/rules-unit-testing
 *   npm i -g firebase-tools        (ou use npx)
 *
 * Executar (sobe o emulador, roda os testes e derruba):
 *   firebase emulators:exec --only firestore "node firestore.rules.test.mjs"
 */

import { readFileSync } from "node:fs";
import assert from "node:assert";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

const PROJECT_ID = "sgcp-rules-test";
const rules = readFileSync("firestore.rules", "utf8");

const ADMIN_EMAIL = "guizen2006@gmail.com";
const ANALISTA_EMAIL = "analista@empresa.com";
const ADMIN_DOC_EMAIL = "chefe@empresa.com";
const VIEWER_EMAIL = "viewer@empresa.com";
const COORDENADOR_EMAIL = "coord@empresa.com";
const COORD_UNI_EMAIL = "coorduni@empresa.com";
const STRANGER_EMAIL = "fulano@empresa.com"; // verificado, mas sem registro

let testEnv;

// --- contextos ---
const ctx = {
  unauth: () => testEnv.unauthenticatedContext().firestore(),
  user: (email) =>
    testEnv
      .authenticatedContext(email, { email, email_verified: true })
      .firestore(),
  unverified: (email) =>
    testEnv
      .authenticatedContext(email, { email, email_verified: false })
      .firestore(),
};

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    // Sem bootstrap por e-mail: o admin precisa estar registrado em `usuarios`.
    await setDoc(doc(db, "usuarios", ADMIN_EMAIL), {
      email: ADMIN_EMAIL,
      role: "Administrador",
      sede: "DT",
    });
    await setDoc(doc(db, "usuarios", ANALISTA_EMAIL), {
      email: ANALISTA_EMAIL,
      role: "Analista",
      sede: "DT",
    });
    await setDoc(doc(db, "usuarios", ADMIN_DOC_EMAIL), {
      email: ADMIN_DOC_EMAIL,
      role: "Administrador",
      sede: "DT",
    });
    await setDoc(doc(db, "usuarios", VIEWER_EMAIL), {
      email: VIEWER_EMAIL,
      role: "Visualizador",
      sede: "",
    });
    await setDoc(doc(db, "usuarios", COORDENADOR_EMAIL), {
      email: COORDENADOR_EMAIL,
      role: "Coordenador",
      sede: "DT",
      // sem `unidade` de propósito: docs antigos devem contar como Colégio
    });
    await setDoc(doc(db, "usuarios", COORD_UNI_EMAIL), {
      email: COORD_UNI_EMAIL,
      role: "Coordenador",
      sede: "PE",
      unidade: "universidade",
    });
    // dados existentes para testes de leitura/update
    await setDoc(doc(db, "vagas", "v1"), { codigo: 1001, vaga: "Dev", status: "ABERTA" });
    await setDoc(doc(db, "entrevistas", "e1"), { codigo: 301, colaborador: "X", dataEntrevista: "01/01/2026" });
    await setDoc(doc(db, "sedes", "s1"), { nome: "DT", regiao: "Sudeste" });
    await setDoc(doc(db, "sedes", "sUni"), { nome: "PE", regiao: "Universidade" });
    // sede legada sem o campo `regiao`: a regra nao pode ESTOURAR por causa disso
    await setDoc(doc(db, "sedes", "sLegada"), { nome: "ANTIGA" });
    await setDoc(doc(db, "logs", "l1"), { timestamp: "t", usuario: "x", acao: "CRIOU", modulo: "Vagas", detalhes: "d" });
    await setDoc(doc(db, "funcionarios", "fn1"), { nome: "Ana", dataNascimento: "24/06/1990", sede: "DT" });
    await setDoc(doc(db, "vagas", "uni-1"), { codigo: 9001, vaga: "NPJ", status: "ABERTA", origem: "planilha-universidade" });
    await setDoc(doc(db, "vagas", "uni-del"), { codigo: 9009, vaga: "Del", status: "ABERTA", origem: "planilha-universidade" });
  });
}

const cases = [];
function test(name, fn) {
  cases.push([name, fn]);
}

// ---------------------------------------------------------------------------
//  VAGAS — leitura pública (exceção temporária), escrita só editor
// ---------------------------------------------------------------------------
test("vagas: leitura SEM auth é NEGADA (integração externa usa service account/IAM)", () =>
  assertFails(getDoc(doc(ctx.unauth(), "vagas", "v1"))));

test("vagas: leitura por usuário do app (provisionado) é permitida", () =>
  assertSucceeds(getDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "v1"))));

test("vagas: leitura por conta Google verificada porém NÃO provisionada é negada", () =>
  assertFails(getDoc(doc(ctx.user(STRANGER_EMAIL), "vagas", "v1"))));

test("vagas: escrita SEM auth é negada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "vagas", "v2"), { codigo: 2, vaga: "Y", status: "ABERTA" })));

test("vagas: analista pode escrever", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "v3"), { codigo: 3, vaga: "Z", status: "ABERTA" })));

test("vagas: visualizador NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "vagas", "v4"), { codigo: 4, vaga: "W", status: "ABERTA" })));

test("vagas: usuário verificado sem registro NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(STRANGER_EMAIL), "vagas", "v5"), { codigo: 5, vaga: "Q", status: "ABERTA" })));

// --- Vagas de planilha: SISTEMA é o dono (editor gerencia; origem não pode ser forjada) ---
test("vagas planilha: analista PODE editar status (origem inalterada)", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "uni-1"), { codigo: 9001, vaga: "NPJ", status: "PAUSADA", origem: "planilha-universidade" })));

test("vagas planilha: analista PODE excluir (delete = editor)", () =>
  assertSucceeds(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "uni-del"))));

test("vagas planilha: analista NÃO pode forjar origem na criação", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "uni-fake"), { codigo: 9002, vaga: "Fake", status: "ABERTA", origem: "planilha-universidade" })));

test("vagas: analista NÃO pode MUDAR a origem de uma vaga (anti-forja no update)", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "v1"), { codigo: 1001, vaga: "Dev", status: "ABERTA", origem: "planilha-universidade" })));

test("vagas planilha: admin PODE editar", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "vagas", "uni-1"), { codigo: 9001, vaga: "NPJ ajustada", status: "ABERTA", origem: "planilha-universidade" })));

test("vagas comuns: analista segue editando normalmente", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "v1"), { codigo: 1001, vaga: "Dev Pleno", status: "ABERTA" })));

// ---------------------------------------------------------------------------
//  ENTREVISTAS — dados pessoais: leitura só verificado
// ---------------------------------------------------------------------------
test("entrevistas: leitura SEM auth é negada", () =>
  assertFails(getDoc(doc(ctx.unauth(), "entrevistas", "e1"))));

test("entrevistas: leitura por usuário verificado é permitida", () =>
  assertSucceeds(getDoc(doc(ctx.user(VIEWER_EMAIL), "entrevistas", "e1"))));

test("entrevistas: leitura por usuário NÃO verificado é negada", () =>
  assertFails(getDoc(doc(ctx.unverified(STRANGER_EMAIL), "entrevistas", "e1"))));

test("entrevistas: leitura por conta Google verificada porém NÃO provisionada é negada", () =>
  assertFails(getDoc(doc(ctx.user(STRANGER_EMAIL), "entrevistas", "e1"))));

test("entrevistas: analista pode escrever", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "entrevistas", "e2"), { codigo: 302, colaborador: "Y", dataEntrevista: "02/02/2026" })));

test("entrevistas: visualizador NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "entrevistas", "e3"), { codigo: 303, colaborador: "Z", dataEntrevista: "03/03/2026" })));

// ---------------------------------------------------------------------------
//  FUNCIONÁRIOS (roster / aniversários) — leitura app user; escrita editor
// ---------------------------------------------------------------------------
test("funcionarios: leitura SEM auth é negada (dado pessoal)", () =>
  assertFails(getDoc(doc(ctx.unauth(), "funcionarios", "fn1"))));

test("funcionarios: leitura por usuário do app é permitida", () =>
  assertSucceeds(getDoc(doc(ctx.user(VIEWER_EMAIL), "funcionarios", "fn1"))));

test("funcionarios: analista (editor) pode escrever", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "funcionarios", "fn2"), { nome: "Bia", dataNascimento: "01/01/1991", sede: "DT" })));

test("funcionarios: visualizador NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "funcionarios", "fn3"), { nome: "Caio", dataNascimento: "02/02/1992", sede: "DT" })));

test("integracoes: leitura SEM auth é negada", () =>
  assertFails(getDoc(doc(ctx.unauth(), "integracoes", "i1"))));

test("integracoes: analista (editor) pode escrever", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "integracoes", "i1"), { nome: "Ana", sede: "PARQUE ECOLÓGICO", status: "Realizado" })));

test("integracoes: visualizador NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "integracoes", "i2"), { nome: "Bia", sede: "ALDEOTA", status: "Não realizado" })));

// --- consultas (solicitacao de especialidade pelo funcionario, modulo do Colegio) ---
const consultaValida = { funcionario: "Marcos Silva", especialidade: "Ortodontia",
  dataSolicitacao: "10/08/2026", status: "No aguardo", dataAtendimento: "" };

test("consultas: leitura SEM auth é negada (nome de colaborador é dado pessoal)", () =>
  assertFails(getDoc(doc(ctx.unauth(), "consultas", "c1"))));

test("consultas: analista (editor) pode criar", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "consultas", "c1"), consultaValida)));

test("consultas: usuário do app lê", () =>
  assertSucceeds(getDoc(doc(ctx.user(VIEWER_EMAIL), "consultas", "c1"))));

test("consultas: coordenador (editor) pode marcar como atendida", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "consultas", "c1"),
    Object.assign({}, consultaValida, { status: "Atendido", dataAtendimento: "15/08/2026" }))));

test("consultas: visualizador NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "consultas", "c2"), consultaValida)));

test("consultas: conta verificada porém NÃO provisionada não lê nem escreve", async () => {
  await assertFails(getDoc(doc(ctx.user(STRANGER_EMAIL), "consultas", "c1")));
  await assertFails(setDoc(doc(ctx.user(STRANGER_EMAIL), "consultas", "c3"), consultaValida));
});

test("consultas: anônimo NÃO pode criar (não é formulário público)", () =>
  assertFails(setDoc(doc(ctx.unauth(), "consultas", "c4"), consultaValida)));

// ---------------------------------------------------------------------------
//  USUÁRIOS — escrita só admin (+validação)
// ---------------------------------------------------------------------------
test("usuarios: analista NÃO pode criar usuário", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "usuarios", "novo@empresa.com"), { email: "novo@empresa.com", role: "Analista", sede: "DT" })));

test("usuarios: admin (registrado) pode criar usuário", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo2@empresa.com"), { email: "novo2@empresa.com", role: "Analista", sede: "DT" })));

test("usuarios: admin (por papel) pode criar usuário", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_DOC_EMAIL), "usuarios", "novo3@empresa.com"), { email: "novo3@empresa.com", role: "Visualizador", sede: "" })));

test("usuarios: admin pode gravar role Coordenador", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "coord@empresa.com"), { email: "coord@empresa.com", role: "Coordenador", sede: "DT" })));

test("usuarios: admin NÃO pode gravar role inválido", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo4@empresa.com"), { email: "novo4@empresa.com", role: "Hacker", sede: "DT" })));

// --- Coordenador (admin regional do Colégio) ---
test("usuarios: coordenador PODE criar Analista", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "usuarios", "novoana@empresa.com"), { email: "novoana@empresa.com", role: "Analista", sede: "DT" })));

test("usuarios: coordenador NÃO pode criar Administrador (sem escalonar)", () =>
  assertFails(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "usuarios", "novoadm@empresa.com"), { email: "novoadm@empresa.com", role: "Administrador", sede: "DT" })));

test("usuarios: coordenador NÃO pode editar um Administrador", () =>
  assertFails(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "usuarios", ADMIN_DOC_EMAIL), { email: ADMIN_DOC_EMAIL, role: "Analista", sede: "DT" })));

test("sedes: coordenador PODE criar sede do Colégio", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "sedes", "sNova"), { nome: "Nova", regiao: "Sul" })));

test("sedes: coordenador NÃO pode criar sede da Universidade", () =>
  assertFails(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "sedes", "sUni2"), { nome: "Campus", regiao: "Universidade" })));

test("sedes: coordenador NÃO pode excluir sede da Universidade", () =>
  assertFails(deleteDoc(doc(ctx.user(COORDENADOR_EMAIL), "sedes", "sUni"))));

test("sedes: coordenador NÃO pode criar/editar Cargos (cadastro global)", () =>
  assertFails(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "cargos", "c99"), { nome: "X" })));

// --- Coordenador da UNIVERSIDADE (unidade denormalizada no doc do usuário) ---
test("sedes: coordenador do Colegio edita sede legada (sem campo regiao) sem estourar a regra", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "sedes", "sLegada"), { nome: "ANTIGA 2" })));

test("usuarios: payload SEM role e' recusado de forma limpa (nao estoura)", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "semrole@empresa.com"), { email: "semrole@empresa.com", sede: "DT" })));

test("sedes: coordenador da UNIVERSIDADE pode criar sede da Universidade", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORD_UNI_EMAIL), "sedes", "sUniNova"), { nome: "Campus Novo", regiao: "Universidade" })));

test("sedes: coordenador da UNIVERSIDADE NÃO pode criar sede do Colégio", () =>
  assertFails(setDoc(doc(ctx.user(COORD_UNI_EMAIL), "sedes", "sColNova"), { nome: "Filial", regiao: "Sul" })));

test("sedes: coordenador da UNIVERSIDADE NÃO pode excluir sede do Colégio", () =>
  assertFails(deleteDoc(doc(ctx.user(COORD_UNI_EMAIL), "sedes", "s1"))));

test("usuarios: coordenador da UNIVERSIDADE segue sem poder criar Administrador", () =>
  assertFails(setDoc(doc(ctx.user(COORD_UNI_EMAIL), "usuarios", "novoadm2@empresa.com"), { email: "novoadm2@empresa.com", role: "Administrador", sede: "PE", unidade: "universidade" })));

test("usuarios: leitura por usuário verificado é permitida", () =>
  assertSucceeds(getDoc(doc(ctx.user(ANALISTA_EMAIL), "usuarios", ANALISTA_EMAIL))));

test("usuarios: leitura SEM auth é negada", () =>
  assertFails(getDoc(doc(ctx.unauth(), "usuarios", ANALISTA_EMAIL))));

// ---------------------------------------------------------------------------
//  SEDES — admin escreve, verificado lê
// ---------------------------------------------------------------------------
test("sedes: analista NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "sedes", "s2"), { nome: "X", regiao: "Sul" })));

test("sedes: admin pode escrever", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "sedes", "s3"), { nome: "Y", regiao: "Sul" })));

// ---------------------------------------------------------------------------
//  SYSTEM_CONFIG — só admin lê/escreve
// ---------------------------------------------------------------------------
test("system_config: usuário comum NÃO lê", () =>
  assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), "system_config", "c1"))));

test("system_config: admin escreve", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "system_config", "c1"), { vagas_seeded: true })));

// ---------------------------------------------------------------------------
//  LOGS — leitura só admin, create por editor, append-only
// ---------------------------------------------------------------------------
test("logs: leitura por não-admin é negada", () =>
  assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "l1"))));

test("logs: leitura por admin é permitida", () =>
  assertSucceeds(getDoc(doc(ctx.user(ADMIN_EMAIL), "logs", "l1"))));

test("logs: analista pode criar log válido", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "l2"), { timestamp: "t", usuario: ANALISTA_EMAIL, acao: "CRIOU", modulo: "Vagas", detalhes: "d" })));

test("logs: criar log com acao inválida é negado", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "l3"), { timestamp: "t", usuario: ANALISTA_EMAIL, acao: "DELETOU_TUDO", modulo: "Vagas", detalhes: "d" })));

test("logs: visualizador NÃO pode criar log", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "logs", "l4"), { timestamp: "t", usuario: VIEWER_EMAIL, acao: "CRIOU", modulo: "Vagas", detalhes: "d" })));

test("logs: update/delete são sempre negados (append-only)", () =>
  assertFails(deleteDoc(doc(ctx.user(ADMIN_EMAIL), "logs", "l1"))));

// ---------------------------------------------------------------------------
//  Caminho desconhecido — negado
// ---------------------------------------------------------------------------
test("coleção desconhecida: leitura negada mesmo para admin", () =>
  assertFails(getDoc(doc(ctx.user(ADMIN_EMAIL), "qualquer_coisa", "x"))));

// ---------------------------------------------------------------------------
//  Runner
// ---------------------------------------------------------------------------
async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
  await seed();

  let pass = 0;
  let fail = 0;
  for (const [name, fn] of cases) {
    try {
      await fn();
      console.log("  ✓ " + name);
      pass++;
    } catch (e) {
      console.error("  ✗ " + name + "\n      " + (e?.message ?? e));
      fail++;
    }
  }
  await testEnv.cleanup();
  console.log(`\n${pass} passaram, ${fail} falharam.`);
  assert.strictEqual(fail, 0, "Há regras com comportamento inesperado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});test("requisicoes: campo de texto gigante e' recusado (anti-abuso do form publico)", () =>
  assertFails(setDoc(doc(ctx.unauth(), "requisicoes", "rGrande"), {
    cargo: "X", sede: "DT", gestorSolicitante: "Y", status: "pendente", criadaEm: "2026-01-01",
    justificativa: "a".repeat(2001)
  })));

test("requisicoes: honeypot preenchido e' recusado no servidor", () =>
  assertFails(setDoc(doc(ctx.unauth(), "requisicoes", "rBot"), {
    cargo: "X", sede: "DT", gestorSolicitante: "Y", status: "pendente", criadaEm: "2026-01-01",
    website: "http://spam"
  })));

test("requisicoes: payload com chaves demais e' recusado", () =>
  assertFails(setDoc(doc(ctx.unauth(), "requisicoes", "rMuitas"), Object.assign(
    { cargo: "X", sede: "DT", gestorSolicitante: "Y", status: "pendente", criadaEm: "2026-01-01" },
    Object.fromEntries(Array.from({length: 25}, (_, i) => ["extra"+i, "v"]))
  ))));




// --- entrevista de desligamento pelo formulario publico (/entrevista) ---
const entrevistaBase = {
  origem: "form-publico",
  colaborador: "Fulano de Tal",
  funcao: "Auxiliar",
  unidade: "Dunas",
  codigo: 2608261530,
  entrevistador: "",
  dataEntrevista: "26/08/2026",
  admissao: "01/02/2024",
  desligamento: "20/08/2026",
  motivoSaida: "Outros",
  gostavaTrabalho: "Sim",
  voltaria: "Talvez",
  oqMaisGostava: "equipe",
  oqMenosGostava: "horario",
  sugestoes: "mais treino",
  notaSalario: 3,
  notaTreinamento: 4,
  notaCrescimento: 2,
  notaRelacionamentoColegas: 5,
  notaRelacionamentoChefia: 4,
  notaClimaOrg: 3,
};

test("entrevistas: form publico consegue criar", () =>
  assertSucceeds(setDoc(doc(ctx.unauth(), "entrevistas", "ePub"), entrevistaBase)));

test("entrevistas: form publico NAO consegue ler as respostas de outros", () =>
  assertFails(getDoc(doc(ctx.unauth(), "entrevistas", "ePub"))));

test("entrevistas: anonimo sem origem 'form-publico' e' recusado", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemOrigem"),
    Object.assign({}, entrevistaBase, { origem: "rh" }))));

test("entrevistas: anonimo nao pode se passar por entrevistador do RH", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eFake"),
    Object.assign({}, entrevistaBase, { entrevistador: "Coordenadora RH" }))));

test("entrevistas: nota fora da escala 1-5 e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eNota"),
    Object.assign({}, entrevistaBase, { notaClimaOrg: 9 }))));

test("entrevistas: enum invalido em voltaria e' recusado", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eEnum"),
    Object.assign({}, entrevistaBase, { voltaria: "Quem sabe" }))));

test("entrevistas: texto gigante e' recusado (anti-abuso)", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eGrande"),
    Object.assign({}, entrevistaBase, { sugestoes: "a".repeat(2001) }))));

test("entrevistas: honeypot preenchido e' recusado no servidor", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eBot"),
    Object.assign({}, entrevistaBase, { website: "http://spam" }))));

test("entrevistas: anonimo NAO pode editar registro existente", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "e1"), entrevistaBase)));

test("entrevistas: anonimo NAO pode apagar registro", () =>
  assertFails(deleteDoc(doc(ctx.unauth(), "entrevistas", "e1"))));


// --- entrevista anonima (checkbox "quero responder anonimamente") ---
// Anonima muda SO o nome: as demais perguntas continuam obrigatorias.
const entrevistaAnon = Object.assign({}, entrevistaBase, {
  anonima: true,
  colaborador: "Anônimo",
});

test("entrevistas: anonima passa sem nome, com o resto preenchido", () =>
  assertSucceeds(setDoc(doc(ctx.unauth(), "entrevistas", "eAnon"), entrevistaAnon)));

test("entrevistas: anonima com nome de verdade e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eAnonNome"),
    Object.assign({}, entrevistaAnon, { colaborador: "Fulano de Tal" }))));

test("entrevistas: anonima SEM funcao e' recusada (anonimato nao dispensa o resto)", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eAnonSemFuncao"),
    Object.assign({}, entrevistaAnon, { funcao: "" }))));

test("entrevistas: anonima nao-booleana e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eAnonStr"),
    Object.assign({}, entrevistaAnon, { anonima: "sim" }))));

// --- obrigatoriedade dos campos do formulario publico ---
test("entrevistas: identificada sem nome e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemNome"),
    Object.assign({}, entrevistaBase, { colaborador: "" }))));

test("entrevistas: sem funcao e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemFuncao"),
    Object.assign({}, entrevistaBase, { funcao: "" }))));

test("entrevistas: sem unidade e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemUnidade"),
    Object.assign({}, entrevistaBase, { unidade: "" }))));

test("entrevistas: sem data de admissao e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemAdm"),
    Object.assign({}, entrevistaBase, { admissao: "" }))));

test("entrevistas: sem data de saida e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemDeslig"),
    Object.assign({}, entrevistaBase, { desligamento: "" }))));

test("entrevistas: sem motivo de saida e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemMotivo"),
    Object.assign({}, entrevistaBase, { motivoSaida: "" }))));

test("entrevistas: 'gostava do trabalho' em branco e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemGostava"),
    Object.assign({}, entrevistaBase, { gostavaTrabalho: "" }))));

test("entrevistas: 'voltaria' em branco e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eSemVoltaria"),
    Object.assign({}, entrevistaBase, { voltaria: "" }))));

test("entrevistas: nota 0 (nao respondida) e' recusada", () =>
  assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "eNotaZero"),
    Object.assign({}, entrevistaBase, { notaClimaOrg: 0 }))));

test("entrevistas: textos livres vazios seguem aceitos (sao os unicos opcionais)", () =>
  assertSucceeds(setDoc(doc(ctx.unauth(), "entrevistas", "eSemTextos"),
    Object.assign({}, entrevistaBase, { oqMaisGostava: "", oqMenosGostava: "", sugestoes: "" }))));

// --- selecoes (eventos de selecao importados das abas QUANTI) ---
const selecaoValida = { data: "13/01/2026", cargo: "Professor(a)", sede: "BENFICA",
  responsavel: "Diana", origem: "pedagogico", convocados: 5, compareceram: 5,
  ausentes: 0, contratados: 0, desistiram: 0 };

test("selecoes: leitura SEM auth e' negada", () =>
  assertFails(getDoc(doc(ctx.unauth(), "selecoes", "s1"))));

test("selecoes: analista pode criar", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "selecoes", "s1"), selecaoValida)));

test("selecoes: visualizador NAO pode criar", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "selecoes", "s2"), selecaoValida)));

test("selecoes: usuario verificado le", () =>
  assertSucceeds(getDoc(doc(ctx.user(VIEWER_EMAIL), "selecoes", "s1"))));

test("selecoes: anonimo NAO pode criar (nao e' formulario publico)", () =>
  assertFails(setDoc(doc(ctx.unauth(), "selecoes", "s3"), selecaoValida)));
