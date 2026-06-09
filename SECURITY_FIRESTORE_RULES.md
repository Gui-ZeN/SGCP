# Segurança das Firestore Rules — SGCP

Documenta a reescrita das `firestore.rules` (que estavam **totalmente abertas**,
`allow read, write: if true` em todas as coleções) e o plano coordenado para a
integração externa do dashboard de Absenteísmo.

> **Não faça deploy sem testar.** Veja a seção [Como testar](#como-testar) antes
> de `firebase deploy --only firestore:rules`. Regras erradas podem **bloquear o
> app em produção**.

---

## 1. Modelo de autorização

Papéis (de `src/hooks/useMetadata.ts`, coleção `usuarios`, ID do documento = e-mail):

| Papel                        | Leitura                              | Escrita                                             |
| ---------------------------- | ------------------------------------ | --------------------------------------------------- |
| `Administrador`              | tudo                                 | tudo (inclui coleções administrativas)              |
| `Analista`                   | tudo (usuário do app)                | dados operacionais (vagas, entrevistas, etc.)       |
| `Visualizador`               | tudo (usuário do app)                | nada                                                |
| Verificado não provisionado  | só `vagas` (exceção temporária)      | nada                                                |
| Não autenticado              | só `vagas` (exceção temporária)      | nada                                                |

Admin é reconhecido por **e-mail bootstrap** (`guizen2006@gmail.com`) **ou** por
ter `role == "Administrador"` na coleção `usuarios`. Uma conta autenticada mas
**não cadastrada** em `usuarios` não recebe permissão de escrita — espelha a tela
de "não autorizado" do app.

Três níveis de "quem é o usuário" são usados nas regras:

- **`isVerifiedUser()`** — qualquer conta Google com `email_verified == true`. O
  login do app é Google Sign-In, que sempre verifica o e-mail, então isso não
  bloqueia usuários legítimos.
- **`isRegistered()`** — usuário que possui documento em `usuarios` (logo, tem um
  papel atribuído).
- **`isAppUser()`** — verificado **e** provisionado (`isAdmin()` ou
  `isRegistered()`). Usado nas leituras de dados sensíveis. Como o login Google
  **não tem restrição de domínio**, sem isso qualquer conta Google poderia ler
  entrevistas de desligamento e período de experiência. `isAppUser()` limita a
  leitura aos usuários efetivamente cadastrados no sistema (ou ao admin
  bootstrap), espelhando o gate de autorização do próprio app.

### Permissões por coleção

| Coleção          | Leitura          | Escrita            | Observação                                   |
| ---------------- | ---------------- | ------------------ | -------------------------------------------- |
| `vagas`          | app user         | editor             | integração externa lê via service account    |
| `usuarios`       | app user         | admin (+validação) | leitura ampla: o app lista para achar o papel|
| `sedes`          | app user         | admin              |                                              |
| `regioes`        | app user         | admin              |                                              |
| `cargos`         | app user         | admin              |                                              |
| `setores`        | app user         | admin              |                                              |
| `system_config`  | admin            | admin              | nenhum cliente lê hoje → menor privilégio    |
| `treinamentos`   | app user         | editor             |                                              |
| `experiencia`    | app user         | editor             | dados pessoais de colaboradores              |
| `entrevistas`    | app user         | editor             | dados sensíveis (desligamento)               |
| `turnover`       | app user         | editor             |                                              |
| `logs`           | admin            | create=editor      | append-only (sem update/delete)              |
| qualquer outra   | negado           | negado             | `match /{document=**}` → `if false`          |

> "app user" = `isAppUser()` (verificado **e** provisionado em `usuarios`, ou
> admin bootstrap).

---

## 2. A integração externa `vagas` (RESOLVIDA)

O dashboard de Absenteísmo (projeto **Google Apps Script separado**) lia a
coleção `vagas` via **Firestore REST API usando só a apiKey web, sem login** —
o que só funcionava porque as regras eram públicas.

**Status:** migrado para a **opção (a)** — o Apps Script agora autentica via
**service account** (OAuth JWT, papel Cloud Datastore Viewer) e a leitura de
`vagas` foi **fechada** (`allow read: if isAppUser()`). A service account usa
IAM, que não passa pelas regras de segurança, então a leitura continua
funcionando com a coleção fechada ao público.

O leitor migrado vive em `DashboardWebApp.gs` (função `fetchVagasFromFirestore_`,
que usa `sgcpAccessToken_`); `AbsenteismoVagas.gs` foi o validador inicial.

### Opção (a) — Apps Script autentica via Service Account (OAuth JWT)  ✅ ADOTADA

O Apps Script passa a autenticar no Firestore com uma **service account** do
Google Cloud (papel read-only), em vez de usar só a apiKey.

> **Código pronto:** [`apps-script/AbsenteismoVagas.gs`](apps-script/AbsenteismoVagas.gs).
> Já trata token OAuth com cache, paginação (`nextPageToken`) e conversão do
> formato REST do Firestore para objetos planos (`{ id, codigo, vaga, ... }`).
> É só colar no projeto Apps Script do dashboard.

**Passo a passo:**

1. **GCP Console → IAM & Admin → Service Accounts** → criar conta
   (ex.: `absenteismo-reader`).
2. Conceder o papel **Cloud Datastore Viewer** (`roles/datastore.viewer`)
   — somente leitura.
3. Na service account → **Keys → Add key → JSON**; baixe o arquivo.
4. No projeto **Apps Script** do dashboard: cole o conteúdo de
   `apps-script/AbsenteismoVagas.gs` e configure em **⚙ Project Settings →
   Script Properties**:
   - `SA_EMAIL` → `client_email` do JSON
   - `SA_PRIVATE_KEY` → `private_key` do JSON (cole como veio, com os `\n`)
   - `GCP_PROJECT_ID` → id do projeto Firebase
   - `FIRESTORE_DB` → `(default)` ou `ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47`
5. Rode `testarLeituraVagas` uma vez (autorize os escopos) e confira o log:
   deve listar o total de vagas. Aponte o resto do dashboard para `fetchVagas()`.
6. **Só então** feche a leitura: troque em `firestore.rules`
   `allow read: if true` → `allow read: if isAppUser()`, rode o teste do
   emulador e faça o deploy das regras.

- ✅ Não muda o SGCP (só fecha a leitura nas regras no passo 6).
- ✅ Service account com leitura apenas; a chave fica fora do app web.

> Observação: as regras do Firestore **não** se aplicam à service account (ela
> usa IAM). Por isso a leitura via Apps Script continua funcionando mesmo com
> `allow read: if isAppUser()`.

> **Qual banco?** O `firebase.json` aponta para dois bancos. Confira no app qual
> está em uso (`VITE_FIREBASE_DATABASE_ID` / `firebase-applet-config.json` →
> `firestoreDatabaseId`) e use o mesmo valor em `FIRESTORE_DB`.

### Opção (b) — Endpoint protegido no `server.ts` do SGCP

O SGCP expõe `GET /api/vagas` protegido por **token compartilhado**; o Apps
Script consome esse endpoint em vez do Firestore direto. Exige adicionar
`firebase-admin` + uma service account ao servidor.

```bash
npm i firebase-admin
```

`.env` (NÃO commitar):
```
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
VAGAS_API_TOKEN=<token-aleatorio-forte>
FIREBASE_DATABASE_ID=(default)
```

Trecho a adicionar em `server.ts` (antes do `bootstrap()`):
```ts
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const adminDb = admin.firestore();
if (process.env.FIREBASE_DATABASE_ID) {
  // adminDb.databaseId — se usar database nomeado, configure conforme a versão do SDK
}

app.get("/api/vagas", async (req, res) => {
  const token = req.header("x-api-token");
  if (!token || token !== process.env.VAGAS_API_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const snap = await adminDb.collection("vagas").get();
    const vagas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ vagas });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "internal" });
  }
});
```

No Apps Script:
```javascript
function fetchVagas_() {
  const resp = UrlFetchApp.fetch('https://SEU-DOMINIO/api/vagas', {
    headers: { 'x-api-token': PropertiesService.getScriptProperties().getProperty('VAGAS_API_TOKEN') }
  });
  return JSON.parse(resp.getContentText()).vagas;
}
```

- ✅ Firestore totalmente fechado; só o servidor (com service account) lê.
- ✅ Controle de acesso por token simples no lado do Apps Script.
- ⚠️ Adiciona dependência (`firebase-admin`) e uma service account ao servidor;
  o endpoint precisa estar acessível publicamente (HTTPS) para o Apps Script.

### Recomendação

Para fechar com menos peças móveis, a **opção (a)** é a mais direta (não toca no
servidor). A **opção (b)** centraliza o acesso atrás do seu domínio e é melhor se
você já for expor outros endpoints protegidos.

---

## 3. Como testar

As regras **não foram deployadas**. O Firebase CLI não está instalado neste
ambiente. Antes do deploy, valide localmente com o emulador.

### 3.1. Instalar ferramentas
```bash
npm i -g firebase-tools          # ou use: npx firebase-tools
npm i -D @firebase/rules-unit-testing
```

### 3.2. Rodar o emulador + testes
```bash
firebase emulators:exec --only firestore "node firestore.rules.test.mjs"
```

O arquivo [`firestore.rules.test.mjs`](firestore.rules.test.mjs) cobre os casos
principais (admin, analista, visualizador, não autenticado) para leitura/escrita
em coleções administrativas, operacionais, logs e a exceção `vagas`.

### 3.3. Alternativa: Simulador do Console
Firebase Console → Firestore → Rules → **Rules Playground**. Simule:
- leitura de `entrevistas` **sem** auth → deve **negar**;
- leitura de `vagas` **sem** auth → deve **permitir** (exceção temporária);
- escrita em `usuarios` como Analista → deve **negar**;
- escrita em `vagas` como Analista → deve **permitir**.

### 3.4. Deploy (só após testar)
```bash
firebase deploy --only firestore:rules
```
O `firebase.json` aplica estas regras aos **dois** bancos configurados
(`(default)` e `ai-studio-...`).

---

## 4. Decisões e pendências

- **Decisão:** adotada a **opção (a)** (service account no Apps Script),
  **concluída**. O dashboard lê via `DashboardWebApp.gs` → `fetchVagasFromFirestore_`
  (auth por `sgcpAccessToken_`). Validado com 168 vagas lidas.
- **`vagas` fechada:** leitura agora exige `isAppUser()`; escrita só editores.
- **Pendência (você):** rodar o teste no emulador e `firebase deploy --only
  firestore:rules`. Opcional: remover a Script Property `FIREBASE_API_KEY` (não
  é mais usada) e **rotacionar a chave da service account exposta no chat**.
- **Nota sobre `usuarios`:** a leitura é liberada a qualquer usuário verificado
  porque o app lista a coleção inteira na inicialização para descobrir o papel do
  usuário. Expõe e-mails/papéis (não dados de colaboradores) a usuários
  autenticados internos — aceitável para uma ferramenta interna de RH. Para
  fechar mais, seria preciso refatorar o cliente para ler só o próprio documento.
