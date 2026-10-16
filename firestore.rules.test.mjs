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
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
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
    await setDoc(doc(db, "setores", "sTI"), { nome: "TI" });
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
    // Analista da Universidade: alvo dos testes de "coordenador mexe em usuário
    // da outra unidade" (auditoria de 14/10/2026).
    await setDoc(doc(db, "usuarios", "anauni@empresa.com"), {
      email: "anauni@empresa.com",
      role: "Analista",
      sede: "PE",
      unidade: "universidade",
    });
    // dados existentes para testes de leitura/update
    await setDoc(doc(db, "vagas", "v1"), { codigo: 1001, vaga: "Dev", status: "ABERTA", escopo: "colegio" });
    await setDoc(doc(db, "entrevistas", "e1"), { codigo: 301, colaborador: "X", dataEntrevista: "01/01/2026", escopo: "colegio" });
    // Isolamento no servidor (14/10/2026): um registro de cada unidade.
    await setDoc(doc(db, "entrevistas", "eUni"), { codigo: 401, colaborador: "Saiu da Uni", dataEntrevista: "01/02/2026", escopo: "universidade" });
    await setDoc(doc(db, "entrevistas", "eLegada"), { codigo: 402, colaborador: "Sem escopo", dataEntrevista: "01/03/2026" });
    await setDoc(doc(db, "candidatos", "cUni"), { selecaoId: "sUni", data: "01/02/2026", nome: "Candidata da Uni", resultado: "aprovado", escopo: "universidade" });
    await setDoc(doc(db, "sedes", "s1"), { nome: "DT", regiao: "Sudeste" });
    await setDoc(doc(db, "sedes", "sUni"), { nome: "PE", regiao: "Universidade" });
    // sede legada sem o campo `regiao`: a regra nao pode ESTOURAR por causa disso
    await setDoc(doc(db, "sedes", "sLegada"), { nome: "ANTIGA" });
    await setDoc(doc(db, "logs", "l1"), { timestamp: "t", usuario: "x", acao: "CRIOU", modulo: "Vagas", detalhes: "d", escopo: "colegio" });
    await setDoc(doc(db, "logs", "lUni"), { timestamp: "t", usuario: "x", acao: "EXCLUIU", modulo: "Entrevistas", detalhes: "desligado da Uni", escopo: "universidade" });
    await setDoc(doc(db, "logs", "lLegado"), { timestamp: "t", usuario: "x", acao: "CRIOU", modulo: "Vagas", detalhes: "d" });
    await setDoc(doc(db, "logs", "lDoAnalista"), { timestamp: "t", usuario: ANALISTA_EMAIL, acao: "CRIOU", modulo: "Vagas", detalhes: "d" });
    await setDoc(doc(db, "funcionarios", "fn1"), { nome: "Ana", dataNascimento: "24/06/1990", sede: "DT", escopo: "colegio" });
    await setDoc(doc(db, "vagas", "uni-1"), { codigo: 9001, vaga: "NPJ", status: "ABERTA", origem: "planilha-universidade", escopo: "universidade" });
    await setDoc(doc(db, "vagas", "uni-del"), { codigo: 9009, vaga: "Del", status: "ABERTA", origem: "planilha-universidade", escopo: "universidade" });
    // Fase 3 do isolamento (14/10/2026): um registro da Universidade por coleção
    // e o contador único dos números.
    for (const col of ["funcionarios", "experiencia", "treinamentos", "integracoes", "organograma", "selecoes", "atividades", "turnover"]) {
      await setDoc(doc(db, col, "daUni"), { nome: "Pessoa da Uni", sede: "PE", escopo: "universidade" });
      await setDoc(doc(db, col, "semEscopo"), { nome: "Legado", sede: "DT" });
    }
    await setDoc(doc(db, "contadores", "vagas"), { ultimo: 2000 });
    await setDoc(doc(db, "diario", "anauni@empresa.com__2026-10-14"), { email: "anauni@empresa.com", data: "14/10/2026", contagens: {}, escopo: "universidade" });
    await setDoc(doc(db, "diario", "x@empresa.com__2026-10-14"), { email: "x@empresa.com", data: "14/10/2026", contagens: { testes: 3 }, escopo: "colegio" });
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
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "v3"), { codigo: 3, vaga: "Z", status: "ABERTA", escopo: "colegio" })));

test("vagas: visualizador NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "vagas", "v4"), { codigo: 4, vaga: "W", status: "ABERTA" })));

test("vagas: usuário verificado sem registro NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(STRANGER_EMAIL), "vagas", "v5"), { codigo: 5, vaga: "Q", status: "ABERTA" })));

// --- Vagas de planilha: SISTEMA é o dono (editor gerencia; origem não pode ser forjada) ---
// A vaga da planilha é da Universidade: quem a edita é o RH de lá.
test("vagas planilha: analista da Universidade PODE editar status (origem inalterada)", () =>
  assertSucceeds(setDoc(doc(ctx.user("anauni@empresa.com"), "vagas", "uni-1"), { codigo: 9001, vaga: "NPJ", status: "PAUSADA", origem: "planilha-universidade", escopo: "universidade" })));

test("vagas planilha: analista da Universidade PODE excluir (delete = editor)", () =>
  assertSucceeds(deleteDoc(doc(ctx.user("anauni@empresa.com"), "vagas", "uni-del"))));

test("vagas planilha: analista NÃO pode forjar origem na criação", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "uni-fake"), { codigo: 9002, vaga: "Fake", status: "ABERTA", origem: "planilha-universidade", escopo: "colegio" })));

test("vagas: analista NÃO pode MUDAR a origem de uma vaga (anti-forja no update)", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "v1"), { codigo: 1001, vaga: "Dev", status: "ABERTA", origem: "planilha-universidade", escopo: "colegio" })));

test("vagas planilha: admin PODE editar", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "vagas", "uni-1"), { codigo: 9001, vaga: "NPJ ajustada", status: "ABERTA", origem: "planilha-universidade", escopo: "universidade" })));

test("vagas comuns: analista segue editando normalmente", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "v1"), { codigo: 1001, vaga: "Dev Pleno", status: "ABERTA", escopo: "colegio" })));

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
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "entrevistas", "e2"), { codigo: 302, colaborador: "Y", dataEntrevista: "02/02/2026", escopo: "colegio" })));

test("entrevistas: visualizador NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "entrevistas", "e3"), { codigo: 303, colaborador: "Z", dataEntrevista: "03/03/2026", escopo: "colegio" })));

// ---------------------------------------------------------------------------
//  FUNCIONÁRIOS (roster / aniversários) — leitura app user; escrita editor
// --- Fase 3 do isolamento (14/10/2026): as demais coleções operacionais.
for (const col of ["funcionarios", "experiencia", "treinamentos", "integracoes", "organograma", "selecoes", "atividades", "turnover", "vagas"]) {
  if (col !== "vagas") {
    test(`isolamento: Colégio NÃO lê ${col} da Universidade`, () =>
      assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), col, "daUni"))));
    test(`isolamento: Universidade lê ${col} da Universidade`, () =>
      assertSucceeds(getDoc(doc(ctx.user("anauni@empresa.com"), col, "daUni"))));
    test(`isolamento: Colégio NÃO apaga ${col} da Universidade`, () =>
      assertFails(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), col, "daUni"))));
    test(`isolamento: Colégio NÃO puxa ${col} da Universidade para si`, () =>
      assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), col, "daUni"), { nome: "Pessoa da Uni", sede: "PE", escopo: "colegio" })));
    test(`isolamento: ${col} sem escopo só o admin lê`, async () => {
      await assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), col, "semEscopo")));
      await assertSucceeds(getDoc(doc(ctx.user(ADMIN_EMAIL), col, "semEscopo")));
    });
  }
  test(`isolamento: ${col} sem filtro é negado para quem não é admin`, () =>
    assertFails(getDocs(collection(ctx.user(ANALISTA_EMAIL), col))));
  test(`isolamento: ${col} filtrado pela própria unidade é permitido`, () =>
    assertSucceeds(getDocs(query(collection(ctx.user(ANALISTA_EMAIL), col), where("escopo", "==", "colegio")))));
  test(`isolamento: Colégio NÃO cria ${col} na Universidade`, () =>
    assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), col, "invadido"), { nome: "X", sede: "PE", escopo: "universidade" })));
  test(`isolamento: ${col} sem escopo é recusado para quem não é admin`, () =>
    assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), col, "semNada"), { nome: "X", sede: "DT" })));
}

test("isolamento: Colégio NÃO lê vaga da Universidade", () =>
  assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), "vagas", "uni-1"))));

test("isolamento: admin grava em qualquer unidade", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "experiencia", "admUni"), { nome: "X", sede: "PE", escopo: "universidade" })));

test("isolamento: admin NÃO grava escopo inválido", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "experiencia", "admRuim"), { nome: "X", sede: "PE", escopo: "COLEGIO" })));

// Contador único dos números de vaga/treinamento.
test("contador: editor lê e sobe", async () => {
  await assertSucceeds(getDoc(doc(ctx.user("anauni@empresa.com"), "contadores", "vagas")));
  await assertSucceeds(updateDoc(doc(ctx.user(ANALISTA_EMAIL), "contadores", "vagas"), { ultimo: 2003 }));
});
test("contador: NÃO salta para um número gigante (travaria a numeração)", () =>
  assertFails(updateDoc(doc(ctx.user(ANALISTA_EMAIL), "contadores", "vagas"), { ultimo: 9007199254740 })));
test("contador: NÃO desce", () =>
  assertFails(updateDoc(doc(ctx.user(ANALISTA_EMAIL), "contadores", "vagas"), { ultimo: 5 })));
test("contador: visualizador NÃO mexe", () =>
  assertFails(updateDoc(doc(ctx.user(VIEWER_EMAIL), "contadores", "vagas"), { ultimo: 9999 })));
test("contador: ninguém cria contador novo pelo app", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "contadores", "outro"), { ultimo: 1 })));

// Diário: o Resumo do Dia é do Colégio.
test("diario: Universidade NÃO lê o diário de outra pessoa", () =>
  assertFails(getDoc(doc(ctx.user("anauni@empresa.com"), "diario", "x@empresa.com__2026-10-14"))));
test("diario: Universidade lê o próprio", () =>
  assertSucceeds(getDoc(doc(ctx.user("anauni@empresa.com"), "diario", "anauni@empresa.com__2026-10-14"))));
test("diario: Colégio lê o da equipe", () =>
  assertSucceeds(getDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", "x@empresa.com__2026-10-14"))));
test("diario: Colégio NÃO lê o diário de alguém da Universidade", () =>
  assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", "anauni@empresa.com__2026-10-14"))));
test("diario: Colégio lista os do Colégio (filtro pela unidade)", () =>
  assertSucceeds(getDocs(query(collection(ctx.user(ANALISTA_EMAIL), "diario"), where("escopo", "==", "colegio")))));
test("diario: NÃO grava o próprio dia em nome da outra unidade", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", "analista@empresa.com__2026-10-15"),
    { email: ANALISTA_EMAIL, data: "15/10/2026", contagens: {}, escopo: "universidade" })));

// Usuários (auditoria, item 9): a lista inteira só para o Admin.
test("usuarios: Colégio NÃO lê o cadastro de alguém da Universidade", () =>
  assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), "usuarios", "anauni@empresa.com"))));
test("usuarios: Colégio NÃO lista todos os usuários", () =>
  assertFails(getDocs(collection(ctx.user(ANALISTA_EMAIL), "usuarios"))));
test("usuarios: lista da própria unidade é permitida", () =>
  assertSucceeds(getDocs(query(collection(ctx.user("anauni@empresa.com"), "usuarios"), where("unidade", "==", "universidade")))));
test("usuarios: admin lista todos", () =>
  assertSucceeds(getDocs(collection(ctx.user(ADMIN_EMAIL), "usuarios"))));

// E-mail não verificado não herda papel (defesa em profundidade).
test("auth: admin com e-mail NÃO verificado não é admin", () =>
  assertFails(getDoc(doc(ctx.unverified(ADMIN_EMAIL), "logs", "l1"))));

// Cadastro sem unidade é recusado.
test("usuarios: cadastro SEM unidade é recusado", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "semunidade@empresa.com"), { email: "semunidade@empresa.com", role: "Analista", sede: "DT" })));

// ---------------------------------------------------------------------------
test("funcionarios: leitura SEM auth é negada (dado pessoal)", () =>
  assertFails(getDoc(doc(ctx.unauth(), "funcionarios", "fn1"))));

test("funcionarios: leitura por usuário do app é permitida", () =>
  assertSucceeds(getDoc(doc(ctx.user(VIEWER_EMAIL), "funcionarios", "fn1"))));

test("funcionarios: analista (editor) pode escrever", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "funcionarios", "fn2"), { nome: "Bia", dataNascimento: "01/01/1991", sede: "DT", escopo: "colegio" })));

test("funcionarios: visualizador NÃO pode escrever", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "funcionarios", "fn3"), { nome: "Caio", dataNascimento: "02/02/1992", sede: "DT" })));

test("integracoes: leitura SEM auth é negada", () =>
  assertFails(getDoc(doc(ctx.unauth(), "integracoes", "i1"))));

test("integracoes: analista (editor) pode escrever", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "integracoes", "i1"), { nome: "Ana", sede: "PARQUE ECOLÓGICO", status: "Realizado", escopo: "colegio" })));

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
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo2@empresa.com"), { email: "novo2@empresa.com", role: "Analista", sede: "DT", unidade: "colegio" })));

test("usuarios: admin (por papel) pode criar usuário", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_DOC_EMAIL), "usuarios", "novo3@empresa.com"), { email: "novo3@empresa.com", role: "Visualizador", sede: "", unidade: "colegio" })));

test("usuarios: admin pode gravar role Coordenador", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "coord@empresa.com"), { email: "coord@empresa.com", role: "Coordenador", sede: "DT", unidade: "colegio" })));

test("usuarios: admin NÃO pode gravar role inválido", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo4@empresa.com"), { email: "novo4@empresa.com", role: "Hacker", sede: "DT" })));

// --- Coordenador (admin regional do Colégio) ---
test("usuarios: coordenador PODE criar Analista", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "usuarios", "novoana@empresa.com"), { email: "novoana@empresa.com", role: "Analista", sede: "DT", unidade: "colegio" })));

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

// Setor nasce no formulário de nova vaga: quem abre vaga declara o setor que
// falta. Renomear e apagar mexem no que já foi contado — só Admin.
test("setores: analista PODE criar setor (só o nome)", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "setores", "sNovo"), { nome: "Nutrição" })));

test("setores: coordenador PODE criar setor", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "setores", "sNovo2"), { nome: "Enfermaria" })));

test("setores: visualizador NÃO cria setor", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "setores", "sNovo3"), { nome: "X" })));

test("setores: analista NÃO cria setor com campo a mais nem nome vazio", async () => {
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "setores", "sNovo4"), { nome: "X", ativo: true }));
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "setores", "sNovo5"), { nome: "" }));
});

test("setores: analista NÃO renomeia nem apaga setor", async () => {
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "setores", "sTI"), { nome: "Tecnologia" }));
  await assertFails(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), "setores", "sTI")));
});

// Candidatos: nome de quem NÃO é funcionário + resultado de teste psicológico.
// Todo o RH lê e grava; Visualizador nem lê (decisão de 23/09/2026).
const candidato = { selecaoId: "s1", data: "23/09/2026", nome: "Fulana de Tal", resultado: "ausente", escopo: "colegio" };

test("candidatos: analista cria e lê", async () => {
  await assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "c1"), candidato));
  await assertSucceeds(getDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "c1")));
});

test("candidatos: coordenador cria", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "candidatos", "c2"), candidato)));

test("candidatos: visualizador NÃO lê nem grava", async () => {
  await assertFails(getDoc(doc(ctx.user(VIEWER_EMAIL), "candidatos", "c1")));
  await assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "candidatos", "c3"), candidato));
});

test("candidatos: sem nome ou sem dia de seleção é recusado", async () => {
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "c4"), { ...candidato, nome: "" }));
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "c5"), { ...candidato, selecaoId: "" }));
});

test("candidatos: quem não está cadastrado não lê", () =>
  assertFails(getDoc(doc(ctx.user(STRANGER_EMAIL), "candidatos", "c1"))));

test("setores: admin segue renomeando e apagando", async () => {
  await assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "setores", "sTI"), { nome: "Tecnologia" }));
  await assertSucceeds(deleteDoc(doc(ctx.user(ADMIN_EMAIL), "setores", "sTI")));
});

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

// --- Auditoria de 14/10/2026: a unidade do coordenador vale no SERVIDOR ---
// Antes, a trava "só a própria unidade" existia só na tela: pelo console, o
// coordenador do Colégio gravava "universidade" no próprio cadastro e passava a
// gerenciar as sedes da Universidade, e mexia em usuários da outra unidade.
test("usuarios: coordenador NÃO muda a própria unidade (ataque 1)", () =>
  assertFails(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "usuarios", COORDENADOR_EMAIL), { email: COORDENADOR_EMAIL, role: "Coordenador", sede: "DT", unidade: "universidade" })));

test("usuarios: coordenador do Colégio NÃO cria usuário da Universidade (ataque 2)", () =>
  assertFails(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "usuarios", "novouni@empresa.com"), { email: "novouni@empresa.com", role: "Analista", sede: "PE", unidade: "universidade" })));

test("usuarios: coordenador do Colégio NÃO puxa usuário da Universidade para o Colégio (ataque 2)", () =>
  assertFails(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "usuarios", "anauni@empresa.com"), { email: "anauni@empresa.com", role: "Visualizador", sede: "DT", unidade: "colegio" })));

test("usuarios: coordenador do Colégio NÃO apaga usuário da Universidade (ataque 2)", () =>
  assertFails(deleteDoc(doc(ctx.user(COORDENADOR_EMAIL), "usuarios", "anauni@empresa.com"))));

// --- Auditoria de 14/10/2026 (ataque 4): isolamento Colégio × Universidade
// NO SERVIDOR. Antes, pelo console, um analista lia (e um editor apagava) as
// entrevistas de desligamento, os candidatos e as consultas da outra unidade.
const ANA_UNI = "anauni@empresa.com";

test("isolamento: analista do Colégio NÃO lê entrevista da Universidade", () =>
  assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), "entrevistas", "eUni"))));

test("isolamento: analista do Colégio NÃO apaga entrevista da Universidade", () =>
  assertFails(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), "entrevistas", "eUni"))));

test("isolamento: analista do Colégio NÃO cria entrevista na Universidade", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "entrevistas", "eInvadida"), { codigo: 9, colaborador: "X", dataEntrevista: "01/01/2026", escopo: "universidade" })));

test("isolamento: analista do Colégio NÃO puxa entrevista da Universidade para o Colégio", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "entrevistas", "eUni"), { codigo: 401, colaborador: "Saiu da Uni", dataEntrevista: "01/02/2026", escopo: "colegio" })));

test("isolamento: analista da Universidade lê a entrevista da Universidade", () =>
  assertSucceeds(getDoc(doc(ctx.user(ANA_UNI), "entrevistas", "eUni"))));

test("isolamento: analista da Universidade NÃO lê entrevista do Colégio", () =>
  assertFails(getDoc(doc(ctx.user(ANA_UNI), "entrevistas", "e1"))));

test("isolamento: administrador lê as duas unidades", async () => {
  await assertSucceeds(getDoc(doc(ctx.user(ADMIN_EMAIL), "entrevistas", "eUni")));
  await assertSucceeds(getDoc(doc(ctx.user(ADMIN_EMAIL), "entrevistas", "e1")));
});

test("isolamento: entrevista sem escopo (antes da migração) só o administrador lê", async () => {
  await assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), "entrevistas", "eLegada")));
  await assertSucceeds(getDoc(doc(ctx.user(ADMIN_EMAIL), "entrevistas", "eLegada")));
});

test("isolamento: a lista filtrada pela própria unidade é permitida", () =>
  assertSucceeds(getDocs(query(collection(ctx.user(ANALISTA_EMAIL), "entrevistas"), where("escopo", "==", "colegio")))));

test("isolamento: a lista inteira (sem filtro) é negada para quem não é administrador", () =>
  assertFails(getDocs(collection(ctx.user(ANALISTA_EMAIL), "entrevistas"))));

test("isolamento: analista do Colégio NÃO lê candidato da Universidade (resultado de teste)", () =>
  assertFails(getDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "cUni"))));

test("isolamento: analista do Colégio NÃO apaga candidato da Universidade", () =>
  assertFails(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "cUni"))));

test("isolamento: analista da Universidade lê o candidato da Universidade", () =>
  assertSucceeds(getDoc(doc(ctx.user(ANA_UNI), "candidatos", "cUni"))));

test("isolamento: analista do Colégio NÃO grava candidato na Universidade", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "cInvadido"), { ...candidato, escopo: "universidade" })));

test("isolamento: candidato sem escopo é recusado", () => {
  const { escopo, ...semEscopo } = candidato;
  return assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "cSemEscopo"), semEscopo));
});

test("isolamento: consultas (módulo do Colégio) NÃO são lidas pela Universidade", () =>
  assertFails(getDoc(doc(ctx.user(ANA_UNI), "consultas", "c1"))));

test("isolamento: consultas NÃO são gravadas pela Universidade", () =>
  assertFails(setDoc(doc(ctx.user(ANA_UNI), "consultas", "cUniFalsa"), consultaValida)));

test("isolamento: formulário público sem escopo é recusado", () => {
  const { escopo, ...semEscopo } = entrevistaBase;
  return assertFails(setDoc(doc(ctx.unauth(), "entrevistas", "ePubSemEscopo"), semEscopo));
});

test("usuarios: coordenador da UNIVERSIDADE edita usuário da Universidade", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORD_UNI_EMAIL), "usuarios", "anauni@empresa.com"), { email: "anauni@empresa.com", role: "Analista", sede: "PE", unidade: "universidade", nome: "Ana" })));

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

// O "Meu dia" mostra o que a pessoa fez no sistema: ela precisa ler as
// PRÓPRIAS linhas do log — e só elas.
test("logs: pessoa lê a própria linha do log", () =>
  assertSucceeds(getDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "lDoAnalista"))));

test("logs: consulta filtrada pelo próprio e-mail é permitida", () =>
  assertSucceeds(getDocs(query(collection(ctx.user(ANALISTA_EMAIL), "logs"), where("usuario", "==", ANALISTA_EMAIL)))));

test("logs: consulta pelo e-mail de um colega é negada", () =>
  assertFails(getDocs(query(collection(ctx.user(ANALISTA_EMAIL), "logs"), where("usuario", "==", "x")))));

test("logs: consulta sem filtro (o log inteiro) continua negada para analista", () =>
  assertFails(getDocs(collection(ctx.user(ANALISTA_EMAIL), "logs"))));

test("logs: analista pode criar log válido", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "l2"), { timestamp: "t", usuario: ANALISTA_EMAIL, acao: "CRIOU", modulo: "Vagas", detalhes: "d", escopo: "colegio" })));

test("logs: criar log com acao inválida é negado", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "l3"), { timestamp: "t", usuario: ANALISTA_EMAIL, acao: "DELETOU_TUDO", modulo: "Vagas", detalhes: "d", escopo: "colegio" })));

// Auditoria de 14/10/2026 (ataque 3): o log alimenta o e-mail das 18h para a
// diretoria. Sem esta trava, um analista atribuía ao colega "removeu 40 vagas".
test("logs: NÃO grava log em nome de outra pessoa (ataque 3)", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "lFalso"), { timestamp: "t", usuario: ADMIN_EMAIL, acao: "EXCLUIU", modulo: "Vagas", detalhes: "removeu 40 vagas", escopo: "colegio" })));

test("logs: visualizador NÃO pode criar log", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "logs", "l4"), { timestamp: "t", usuario: VIEWER_EMAIL, acao: "CRIOU", modulo: "Vagas", detalhes: "d", escopo: "colegio" })));

// --- Fase 2 do isolamento (14/10/2026): o log tem unidade.
test("isolamento: coordenador do Colégio lê log do Colégio", () =>
  assertSucceeds(getDoc(doc(ctx.user(COORDENADOR_EMAIL), "logs", "l1"))));

test("isolamento: coordenador do Colégio NÃO lê log da Universidade", () =>
  assertFails(getDoc(doc(ctx.user(COORDENADOR_EMAIL), "logs", "lUni"))));

test("isolamento: coordenador da Universidade lê log da Universidade", () =>
  assertSucceeds(getDoc(doc(ctx.user(COORD_UNI_EMAIL), "logs", "lUni"))));

test("isolamento: coordenador da Universidade NÃO lê log do Colégio", () =>
  assertFails(getDoc(doc(ctx.user(COORD_UNI_EMAIL), "logs", "l1"))));

test("isolamento: log sem escopo (antes da migração) só o admin lê", async () => {
  await assertFails(getDoc(doc(ctx.user(COORDENADOR_EMAIL), "logs", "lLegado")));
  await assertSucceeds(getDoc(doc(ctx.user(ADMIN_EMAIL), "logs", "lLegado")));
});

test("isolamento: coordenador lista os logs filtrando pela própria unidade", () =>
  assertSucceeds(getDocs(query(collection(ctx.user(COORD_UNI_EMAIL), "logs"), where("escopo", "==", "universidade")))));

test("isolamento: coordenador NÃO lista o log inteiro sem filtro", () =>
  assertFails(getDocs(collection(ctx.user(COORD_UNI_EMAIL), "logs"))));

test("isolamento: log sem escopo é recusado", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "lSem"), { timestamp: "t", usuario: ANALISTA_EMAIL, acao: "CRIOU", modulo: "Vagas", detalhes: "d" })));

test("isolamento: analista do Colégio NÃO grava log na Universidade", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "logs", "lInv"), { timestamp: "t", usuario: ANALISTA_EMAIL, acao: "CRIOU", modulo: "Vagas", detalhes: "d", escopo: "universidade" })));

test("isolamento: admin grava log de qualquer unidade", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "logs", "lAdm"), { timestamp: "t", usuario: ADMIN_EMAIL, acao: "CRIOU", modulo: "Vagas", detalhes: "d", escopo: "universidade" })));

// --- Banco de candidatos (16/10/2026): "Nunca mais chamar" ---------------
const marca = (por, over = {}) => ({ escopo: "colegio", nome: "Bruno Reis", nomeNorm: "bruno reis", motivo: "Faltou repetidas vezes", por, em: serverTimestamp(), ...over });
const desfazer = (por, over = {}) => ({ desfeito: { por, em: serverTimestamp(), motivo: "Marcado por engano", ...over } });

test("naoChamar: analista marca na própria unidade", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc1"), marca(ANALISTA_EMAIL))));
test("naoChamar: NÃO marca em nome de outra pessoa", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc2"), marca(ADMIN_EMAIL))));
test("naoChamar: NÃO marca com hora escolhida pelo cliente", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc3"), marca(ANALISTA_EMAIL, { em: new Date("2020-01-01") }))));
test("naoChamar: motivo curto demais é recusado", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc4"), marca(ANALISTA_EMAIL, { motivo: "." }))));
test("naoChamar: NÃO marca na outra unidade", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc5"), marca(ANALISTA_EMAIL, { escopo: "universidade" }))));
test("naoChamar: NÃO nasce já desfeita, nem com campo a mais", async () => {
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc6"), { ...marca(ANALISTA_EMAIL), ...desfazer(ANALISTA_EMAIL) }));
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc7"), marca(ANALISTA_EMAIL, { cpf: "123" })));
});
test("naoChamar: telefone tem de ser só dígitos com DDD", async () => {
  await assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc8"), marca(ANALISTA_EMAIL, { telefone: "85999991234" })));
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc9"), marca(ANALISTA_EMAIL, { telefone: "(85) 9999" })));
});
test("naoChamar: visualizador NÃO lê nem marca", async () => {
  await assertFails(getDoc(doc(ctx.user(VIEWER_EMAIL), "naoChamar", "nc1")));
  await assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "naoChamar", "nc10"), marca(VIEWER_EMAIL)));
});
test("naoChamar: Universidade NÃO lê a marca do Colégio", () =>
  assertFails(getDoc(doc(ctx.user("anauni@empresa.com"), "naoChamar", "nc1"))));
test("naoChamar: analista NÃO desfaz", () =>
  assertFails(updateDoc(doc(ctx.user(ANALISTA_EMAIL), "naoChamar", "nc1"), desfazer(ANALISTA_EMAIL))));
test("naoChamar: coordenador da OUTRA unidade NÃO desfaz", () =>
  assertFails(updateDoc(doc(ctx.user(COORD_UNI_EMAIL), "naoChamar", "nc1"), desfazer(COORD_UNI_EMAIL))));
test("naoChamar: coordenador desfaz só o campo desfeito, com o próprio e-mail", async () => {
  await assertFails(updateDoc(doc(ctx.user(COORDENADOR_EMAIL), "naoChamar", "nc1"), { motivo: "trocado" }));
  await assertFails(updateDoc(doc(ctx.user(COORDENADOR_EMAIL), "naoChamar", "nc1"), desfazer(ADMIN_EMAIL)));
  await assertSucceeds(updateDoc(doc(ctx.user(COORDENADOR_EMAIL), "naoChamar", "nc1"), desfazer(COORDENADOR_EMAIL)));
});
test("naoChamar: marca desfeita não se desfaz de novo (a trilha não se reescreve)", () =>
  assertFails(updateDoc(doc(ctx.user(ADMIN_EMAIL), "naoChamar", "nc1"), desfazer(ADMIN_EMAIL))));
test("naoChamar: ninguém apaga, nem o admin", () =>
  assertFails(deleteDoc(doc(ctx.user(ADMIN_EMAIL), "naoChamar", "nc8"))));
test("candidatos: telefone com DDD é aceito; lixo no telefone é recusado", async () => {
  await assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "cTel"), { ...candidato, telefone: "85999991234" }));
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "candidatos", "cTel2"), { ...candidato, telefone: "ligar depois" }));
});

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
  escopo: "colegio",
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
  ausentes: 0, contratados: 0, desistiram: 0, escopo: "colegio" };

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

// --- atividades (o que o RH fez no dia e nao foi selecao) -------------------
const atividadeValida = { data: "22/09/2026", titulo: "Montagem dos kits do Setembro Amarelo",
  detalhe: "120 kits", responsavel: "Arlana", sede: "DIONISIO TORRES", escopo: "colegio" };

test("atividades: leitura SEM auth e' negada", () =>
  assertFails(getDoc(doc(ctx.unauth(), "atividades", "a1"))));

test("atividades: analista pode criar", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "atividades", "a1"), atividadeValida)));

test("atividades: visualizador NAO pode criar", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "atividades", "a2"), atividadeValida)));

test("atividades: usuario verificado le", () =>
  assertSucceeds(getDoc(doc(ctx.user(VIEWER_EMAIL), "atividades", "a1"))));

test("atividades: anonimo NAO pode criar", () =>
  assertFails(setDoc(doc(ctx.unauth(), "atividades", "a3"), atividadeValida)));

// --- diario ("Meu dia": cada pessoa grava SO o proprio) ---------------------
const diarioDe = (email, over = {}) => Object.assign(
  { email, data: "22/09/2026", contagens: { atendimentos: 6, testes: 1, t_nova: 3 }, escopo: "colegio" }, over);
const idDiario = (email) => `${email}__2026-09-22`;

test("diario: pessoa grava o proprio dia", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", idDiario(ANALISTA_EMAIL)), diarioDe(ANALISTA_EMAIL))));

test("diario: NAO grava o dia de um colega (email de outro no documento)", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", idDiario(VIEWER_EMAIL)), diarioDe(VIEWER_EMAIL))));

test("diario: NAO grava no id de um colega com o proprio email dentro", () =>
  // A segunda trava: sem ela, bastava trocar o id para sobrescrever o colega.
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", idDiario(VIEWER_EMAIL)), diarioDe(ANALISTA_EMAIL))));

test("diario: nem o admin grava o dia de outra pessoa", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "diario", idDiario(ANALISTA_EMAIL)), diarioDe(ANALISTA_EMAIL))));

// As contagens viraram mapa (tarefa → quantidade) quando a lista de tarefas
// passou a ser da equipe. Regra não percorre valores de mapa: o banco trava
// formato e tamanho, e o relato ignora valor que não for número positivo.
test("diario: contagens que nao sao mapa sao recusadas", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", idDiario(ANALISTA_EMAIL)), diarioDe(ANALISTA_EMAIL, { contagens: "6 atendimentos" }))));

test("diario: mapa de contagens gigante e' recusado", () => {
  const enorme = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`t${i}`, 1]));
  return assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", idDiario(ANALISTA_EMAIL)), diarioDe(ANALISTA_EMAIL, { contagens: enorme })));
});

// --- tarefasDiario (lista da EQUIPE) -------------------------------------------
test("tarefas: analista cria tarefa nova para a equipe", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "tarefasDiario", "tNova"), { nome: "Entrevistas por telefone", ordem: 5, arquivada: false })));

test("tarefas: analista NAO arquiva por atalho (criar ja arquivada)", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "tarefasDiario", "tArq"), { nome: "X", arquivada: true })));

test("tarefas: analista NAO mexe numa tarefa padrao", () =>
  // As padrão vivem no código; criar o id delas no banco é renomear/arquivar.
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "tarefasDiario", "testes"), { nome: "Outro nome" })));

test("tarefas: coordenador arquiva uma tarefa padrao", () =>
  assertSucceeds(setDoc(doc(ctx.user(COORDENADOR_EMAIL), "tarefasDiario", "testes"), { nome: "Testes psicológicos aplicados", arquivada: true })));

// Apagar: só Admin/Coordenador. As quatro padrão vivem no código e nunca se
// apagam.
test("tarefas: coordenador apaga uma tarefa criada pela equipe", async () => {
  await testEnv.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "tarefasDiario", "tApagar"), { nome: "Reunião com X", ordem: 9, arquivada: false }));
  await assertSucceeds(deleteDoc(doc(ctx.user(COORDENADOR_EMAIL), "tarefasDiario", "tApagar")));
});

test("tarefas: analista NAO apaga tarefa", async () => {
  await testEnv.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "tarefasDiario", "tFica"), { nome: "Y", ordem: 9, arquivada: false }));
  await assertFails(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), "tarefasDiario", "tFica")));
});

test("tarefas: ninguem apaga uma das quatro padrao", () =>
  assertFails(deleteDoc(doc(ctx.user(ADMIN_EMAIL), "tarefasDiario", "atendimentos"))));

test("tarefas: analista NAO renomeia tarefa existente", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "tarefasDiario", "tNova"), { nome: "Renomeada", ordem: 5 })));

test("tarefas: nome vazio ou longo demais e' recusado", async () => {
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "tarefasDiario", "tVazia"), { nome: "" }));
  await assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "tarefasDiario", "tLonga"), { nome: "x".repeat(61) }));
});

// Apagar tarefa já contada é permitido; o relato ignora a contagem órfã
// (testado em resumoDia.test). Aqui fica o que a regra garante sozinha.
test("tarefas: visualizador NAO apaga", () =>
  assertFails(deleteDoc(doc(ctx.user(VIEWER_EMAIL), "tarefasDiario", "tNova"))));

test("tarefas: visualizador NAO cria", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "tarefasDiario", "tViewer"), { nome: "Y" })));

test("diario: data fora do formato e' recusada", () =>
  assertFails(setDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", idDiario(ANALISTA_EMAIL)), diarioDe(ANALISTA_EMAIL, { data: "2026-09-22" }))));

test("diario: ninguem apaga (o historico alimenta o acumulado)", () =>
  assertFails(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), "diario", idDiario(ANALISTA_EMAIL)))));

test("diario: anonimo NAO le", () =>
  assertFails(getDoc(doc(ctx.unauth(), "diario", idDiario(ANALISTA_EMAIL)))));

// --- usuarios: nome de exibicao (vai no assunto do e-mail diario) ------------
test("usuarios: admin grava nome de exibicao", () =>
  assertSucceeds(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo@empresa.com"),
    { email: "novo@empresa.com", role: "Analista", sede: "DT", nome: "Arlana Gomes", unidade: "colegio" })));

test("usuarios: nome que nao e' texto e' recusado", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo2@empresa.com"),
    { email: "novo2@empresa.com", role: "Analista", sede: "DT", nome: 42 })));

test("usuarios: nome acima de 120 caracteres e' recusado", () =>
  assertFails(setDoc(doc(ctx.user(ADMIN_EMAIL), "usuarios", "novo3@empresa.com"),
    { email: "novo3@empresa.com", role: "Analista", sede: "DT", nome: "x".repeat(121) })));

// --- organograma: caixas do desenho (nome + cargo = dado interno) -----------
const noOrganograma = { nome: "Ana Silva", cargo: "COORDENADOR(A)", sede: "DIONISIO TORRES", escopo: "colegio" };

test("organograma: leitura SEM auth e' negada", () =>
  assertFails(getDoc(doc(ctx.unauth(), "organograma", "o1"))));

test("organograma: analista pode criar caixa", () =>
  assertSucceeds(setDoc(doc(ctx.user(ANALISTA_EMAIL), "organograma", "o1"), noOrganograma)));

test("organograma: visualizador NAO pode criar", () =>
  assertFails(setDoc(doc(ctx.user(VIEWER_EMAIL), "organograma", "o2"), noOrganograma)));

test("organograma: usuario verificado le", () =>
  assertSucceeds(getDoc(doc(ctx.user(VIEWER_EMAIL), "organograma", "o1"))));

test("organograma: anonimo NAO pode criar (nao ha formulario publico aqui)", () =>
  assertFails(setDoc(doc(ctx.unauth(), "organograma", "o3"), noOrganograma)));

test("organograma: analista pode apagar caixa (desenho e' editavel)", () =>
  assertSucceeds(deleteDoc(doc(ctx.user(ANALISTA_EMAIL), "organograma", "o1"))));
