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
    // dados existentes para testes de leitura/update
    await setDoc(doc(db, "vagas", "v1"), { codigo: 1001, vaga: "Dev", status: "ABERTA" });
    await setDoc(doc(db, "entrevistas", "e1"), { codigo: 301, colaborador: "X", dataEntrevista: "01/01/2026" });
    await setDoc(doc(db, "sedes", "s1"), { nome: "DT", regiao: "Sudeste" });
    await setDoc(doc(db, "logs", "l1"), { timestamp: "t", usuario: "x", acao: "CRIOU", modulo: "Vagas", detalhes: "d" });
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
//  USUÁRIOS — escrita só admin (+validação)
// ---------------------------------------------------------------------------
test("usuarios: analista NÃO pode criar usuário", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "usuarios", "novo@empresa.com"), { email: "novo@empresa.com", role: "Analista", sede: "DT" })));

test("usuarios: admin (bootstrap) pode criar usuário", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo2@empresa.com"), { email: "novo2@empresa.com", role: "Analista", sede: "DT" })));

test("usuarios: admin (por papel) pode criar usuário", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_DOC_EMAIL), "usuarios", "novo3@empresa.com"), { email: "novo3@empresa.com", role: "Visualizador", sede: "" })));

test("usuarios: admin NÃO pode gravar role inválido", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo4@empresa.com"), { email: "novo4@empresa.com", role: "Hacker", sede: "DT" })));

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
