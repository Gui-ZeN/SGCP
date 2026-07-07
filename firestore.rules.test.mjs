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
    await setDoc(doc(db, "logs", "l1"), { timestamp: "t", usuario: "x", acao: "CRIOU", modulo: "Vagas", detalhes: "d" });
    await setDoc(doc(db, "funcionarios", "fn1"), { nome: "Ana", dataNascimento: "24/06/1990", sede: "DT" });
    await setDoc(doc(db, "vagas", "uni-1"), { codigo: 9001, vaga: "NPJ", status: "ABERTA", origem: "planilha-universidade" });
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

// --- Vagas de planilha (origem planilha-*) são somente-leitura p/ não-admin ---
test("vagas planilha: analista NÃO pode editar", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "uni-1"), { codigo: 9001, vaga: "NPJ 2", status: "ABERTA", origem: "planilha-universidade" })));

test("vagas planilha: analista NÃO pode excluir", () =>
  assertFails(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "uni-1"))));

test("vagas planilha: analista NÃO pode forjar origem na criação", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "uni-fake"), { codigo: 9002, vaga: "Fake", status: "ABERTA", origem: "planilha-universidade" })));

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
});
