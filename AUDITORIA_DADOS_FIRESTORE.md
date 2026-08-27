# Auditoria de dados do Firestore — SGCP

**Data da leitura:** 27/08/2026
**Projeto:** `project-312a1a63-026e-4dfa-91c` · **Banco:** `ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47` (Firestore Native, edition ENTERPRISE)
**Método:** leitura direta da REST API do Firestore (`GET .../documents/{colecao}`, paginado), autenticada por ADC do usuário. **Somente leitura — nenhuma escrita foi feita.** Os números abaixo são **medidos**, não estimados; nenhum veio do cache `localStorage` dos hooks.

> **Este é o único ambiente.** O projeto tem um só Firebase project e um só banco — não existe `(default)` nem projeto de desenvolvimento. Como não há `.env` local, `src/lib/firebase.ts:23` cai no `firebase-applet-config.json` commitado, que aponta para este mesmo banco. **Rodar `npm run dev` na máquina lê e escreve na base real.**

---

## 1. Volume por coleção

| Coleção | Docs | Observação |
|---|---:|---|
| `/vagas` | **403** | 178 vindos do sync da Universidade (id `uni-*`) |
| `/experiencia` | **589** | maior coleção operacional |
| `/integracoes` | **441** | só sedes da Universidade (correto) |
| `/treinamentos` | **173** | |
| `/logs` | **871** | append-only |
| `/entrevistas` | **26** | amostra pequena |
| `/usuarios` | **14** | 10 Coordenadores, 2 Administradores, 1 Analista, 1 Visualizador |
| `/sedes` | **24** | catálogo |
| `/setores` | **24** | catálogo — mas as vagas usam **51** valores distintos |
| `/regioes` | **6** | catálogo |
| `/cargos` | **5** | catálogo — praticamente não usado |
| `/turnover` | **1** | ⚠️ um único mês (`07/2026`) |
| `/requisicoes` | **0** | ⚠️ vazia |
| `/funcionarios` | **0** | ⚠️ vazia |
| `/system_config` | 1 | flags de seed |
| `/config` | 1 | doc `ui`, mapa `enfeites` |

**Coleções vazias.** `/requisicoes` e `/funcionarios` não têm nenhum documento. O formulário público de requisição (`/requisicao`) nunca gerou registro, e a fundação de Funcionários/Aniversários não tem roster. Nada que dependa delas pode ser exibido como indicador.

---

## 2. Cobertura de campos

Cobertura = % de documentos da coleção com o campo presente **e** não-vazio (string em branco conta como vazio).

### `/vagas` — 403 docs

| Campo | Cobertura | Tipos | Notas |
|---|---:|---|---|
| `codigo`, `vaga`, `sede`, `setor`, `status`, `solicitante`, `responsavel`, `categoria`, `categoriaMotivo`, `sexo`, `ano` | **100%** | string/integer | `codigo` vai de 0 a 2.147.180.148 (hash do import convive com sequencial) |
| `solicitacao` | 100% | string | 403/403 em `DD/MM/YYYY` — uniforme |
| `tempoProcesso` | 95,5% | integer | **min = −46.129** |
| `motivo` | 94,8% | string | |
| `aprovado` | 73,2% | string | |
| `funcionarioSubstituido` | 72,7% | string | |
| `conclusao` | 72,7% | string | 293 `DD/MM/YYYY` + 35 vazias |
| `mesSolicitacao` | 55,8% | string | |
| `origem` | 44,2% | string | único valor: `planilha-universidade` (178) |
| `tempoSla` | **39,5%** | integer | **3 valores negativos** (−46.153, −46.150, −46.129) |
| `etapa` | **38,2%** | string | 31 valores distintos, texto livre |
| `mesConclusao` | 33,3% | string | |
| `observacoes` | 19,9% | string | |
| `etapaDesde` | **18,6%** | string | 75 docs, todos `YYYY-MM-DD` |
| `candChamados` / `candCompareceram` / `candAprovados` | **15,1%** | integer | 61 de 403 vagas |
| `motivoDesistencia` | **3,5%** | string | 14 docs com valor (47 vazios) |
| `pausadaDesde` | 2,2% | string | 9 docs |
| `diasPausados` | **0,2%** | integer | **1 doc** |

### `/experiencia` — 589 docs

| Campo | Cobertura | Notas |
|---|---:|---|
| `colaborador`, `funcao`, `supervisor`, `sede`, `status`, `dataAdmissao`, `termino1`, `termino2` | **100%** | todas as datas em `DD/MM/YYYY`, formato uniforme |
| `observacoes` | 91,5% | |
| `setor` | **52,5%** | 280 vazios — e os preenchidos estão contaminados (ver §3) |
| `tipoEncerramento` | **0,5%** | 3 docs, todos `a_pedido` — contra 139 `ENCERRADO` |
| `dataPedidoRescisao` | 0,5% | 3 docs |

Status: `EFETIVADO` 327 · `ENCERRADO` 139 · `PRORROGADO` 70 · `EM_ANALISE` 53. Domínio limpo.

### `/treinamentos` — 173 docs

| Campo | Cobertura | Notas |
|---|---:|---|
| `tema`, `tipo`, `facilitador`, `publico`, `unidade`, `mesReferencia`, `dataInicio`, `cargaHoraria`, `qtdPrevista`, `qtdRealizada`, `totalHorasFormacao`, `valorInvestido` | **100%** | |
| `hora` | 60,7% | |
| `dataTermino` | **11,6%** | 19 `DD/MM/YYYY` + 1 fora de formato |

- `valorInvestido`: **157 dos 173 registros valem 0**. Só 16 têm valor; a soma total é **R$ 4.416**.
- `tipo`: só 3 dos 5 valores do domínio aparecem — `Comportamental` 152, `Técnico` 20, `Integração` 1. `Liderança` e `Operacional` nunca ocorrem.
- `cargaHoraria` e `totalHorasFormacao` misturam `integer` e `double` (ex.: 0,43 h; 23,43 h) — herança do parser de horas do Excel.
- Soma prevista 4.402 × realizada 3.588; 5 registros têm realizada > prevista.

### `/entrevistas` — 26 docs

Todos os campos a **100%**, exceto `sugestoes` (96,2%). Cobertura ótima — **volume baixo (n=26)**.

| Nota | Média | Valores distintos | Fora de 1–5 |
|---|---:|---|---:|
| `notaSalario` | 3,23 | 0,5 · 1 · 2 · 3 · 4 · 5 | 2 |
| `notaTreinamento` | 4,17 | 0,5 · 2,5 · 3 · 4 · 5 | 2 |
| `notaCrescimento` | 3,02 | 0,5 · 1 · 2 · 2,5 · 3 · 4 · 5 | 1 |
| `notaRelacionamentoColegas` | 4,46 | 1 · 2,5 · 4 · 4,5 · 5 | 0 |
| `notaRelacionamentoChefia` | 4,50 | 2,5 · 3 · 4 · 4,5 · 5 | 0 |
| `notaClimaOrg` | 3,62 | 2 · 2,5 · 3 · 4 · 5 | 0 |

O tipo declara `number // 1-5`, mas há **meias-notas (0,5 / 2,5 / 4,5)** e **5 valores abaixo de 1**. Uma escala rotulada "1 a 5" está recebendo valores fora do domínio.

`gostavaTrabalho` = **"Sim" em 26 de 26**: variância zero, não discrimina nada.
Os campos `origem` e `anonima` **não existem em nenhum doc** — o formulário público de entrevista ainda não recebeu resposta.

### `/integracoes` — 441 docs

`nome`, `funcao`, `setor`, `sede`, `supervisor`, `status` a 100%; `admissao` 98,6%; `responsavel` 90%; `contato` 42,2%; `observacao` **0,2%**. `dataIntegracao` 85,5% mas é **texto livre** (377 fora de qualquer formato de data — por design). Status: `Realizado` 271 · `Não realizado` 166 · `Desligado` 4. As 6 sedes são todas da Universidade.

### `/logs` — 871 docs

`timestamp` (100%, ISO uniforme), `usuario`, `acao`, `modulo`, `detalhes` a 100%. **`regiao` só 50,1%** — 435 logs sem região, o que quebra qualquer filtro regional de auditoria. Ações: `ALTEROU` 387 · `EXCLUIU` 265 · `CRIOU` 219. Módulos: Vagas 346 · Turnover 189 · Experiências 164 · Treinamentos 67 · Usuários 56 · Entrevistas 27 · Integrações 10 · Sedes 7 · Setores 5.

### `/usuarios` — 14 docs

`role` e `email` 100%; `sede` 92,9% (1 usuário sem sede); **`unidade` só 50%**.
**5 dos 10 Coordenadores não têm `unidade`.** As rules travam a sede pela unidade e docs antigos são tratados como Colégio — então há coordenador da Universidade com escopo de Colégio até ser re-salvo no painel. Isso é o alerta já registrado no devlog, agora quantificado.

---

## 3. Consistência de domínio

### `status` das vagas — limpo
`FECHADA` 292 · `ABERTA` 67 · `SUSPENSA` 21 · `DOCUMENTAÇÃO` 10 · `REABERTA` 7 · `PAUSADA` 6. Os 6 valores batem com o tipo.

### `sede` — 34 grafias para 24 sedes reais ⚠️

O maior problema de consistência. Sigla e nome coexistem no mesmo campo, e há variação de caixa:

| Rótulo desenhado | Valores que colidem | Total real |
|---|---|---:|
| **DT** | `DT` (63) + `DIONISIO TORRES` (20) | **83** |
| PQL 3 | `PARQUELANDIA 3` (19) + `PQL 3` (1) | 20 |
| BS | `BS` (10) + `BARAO STUADART` (6) | 16 |
| SUL 2 | `SUL 2` (8) + `Sul 2` (6) | 14 |
| SP | `SP` (7) + `SILVA PAULET` (6) | 13 |
| PQL 1 | `PARQUELANDIA 1` (5) + `PQL 1` (4) | 9 |
| SUL 3 | `Sul 3` (4) + `SUL 3` (3) | 7 |
| UC | `Unichristus` (4) + `UNICHRISTUS` (3) | 7 |
| PN | `PRE NUNES` (4) + `PN` (2) | 6 |
| PQL 2 | `PQL 2` (2) + `PARQUELANDIA 2` (1) | 3 |

**São 10 colisões.** O gráfico "Vagas por Sede (Top 6)" agrupa pela string crua e só depois converte para sigla (`getSedeSigla`, `RecruitmentDashboard.tsx:113`), que casa **apenas por nome**, nunca por sigla. Consequência medida: a barra do topo mostra **DT = 63 quando o valor real é 83** — subestimação de 24%. `DIONISIO TORRES` (20) vira uma sétima barra e some do Top 6.

Vale notar que `utils/unidade.ts:regiaoDaSede` **faz** o casamento por nome *ou* sigla. A regra de isolamento está certa; é o gráfico que usa uma função própria e incompleta.

18 vagas usam sede fora do catálogo: `d.valeria` (8), `cd lojinha` (6), `pré - sul` (2), `kmc2` (2).

### `setor` — 51 valores para um catálogo de 24 ⚠️
`Secretaria de Cursos` (18) × `Secretaria de cursos` (6); `D.Valeria` (8) × `D. Valéria` (4); `TI` (5) × `Informática` (10) × `Suporte Sistemas` (4); `RH` (2) × `Recursos Humanos` (1); `Segurança` (3) × `Segurança/Portaria` (3); e `-` (5) como preenchimento. O gráfico de SLA por setor recebe **40 setores distintos** e mostra os 6 primeiros.

Em `/experiencia` o campo `setor` está pior: dos 309 preenchidos, os quatro valores mais frequentes — `Dom Luís` (76), `Aldeota` (60), `Eusébio` (44), `Benfica` (18) — são **sedes, não setores**. Agrupar experiência por setor produz um gráfico sem sentido.

### `etapa` — texto livre ⚠️
31 valores distintos em 168 docs, incluindo `candidata aprovada` (30) e `candidato aprovado` (13) — o mesmo estado partido por gênero — e frases inteiras (`Seleção dia 30/07 e não compareceu ninguém`, `Ass contrato 18/05`).

`normalizeEtapa` (`utils/vaga.ts:133`) colapsa isso em 5 etapas do funil por busca de substring, então o gráfico **não** desenha 31 barras. Mas o fallback é `return 'Triagem'`: etapa vazia, `candidata aprovada` e qualquer texto sem palavra-chave caem todos em "Triagem". Das **111 vagas ativas, só 52 têm etapa preenchida** — as outras 59 são contabilizadas como Triagem. O gráfico lê como "Triagem é o gargalo" quando na verdade diz "não sabemos a etapa".

### `mesReferencia` dos treinamentos — caixa inconsistente ⚠️
15 valores para 12 meses: `agosto` (26) × `Agosto` (5); `julho` (9) × `Julho` (1); `Junho` (8) × `junho` (1); `maio` (28) × `MAIO` (1). Qualquer série mensal de treinamentos quebra em 15 fatias.

### `motivoSaida` das entrevistas — free text dentro do catálogo ⚠️
12 valores distintos para 26 registros. `Conseguiu outro emprego` (12) convive com `Outros: Conseguiu outro emprego` (1) e com strings longas do tipo `Outros: Conseguiu outro emprego com: Salário maior;Plano de saúde;Bonificação mensal; VR: 22,00 por dia`. Um gráfico de barras aqui rende 12 categorias, 9 delas com n=1, e rótulos que não cabem.

### `unidade` das entrevistas — valores compostos
`DT` (19), mas também `DIONISIO TORRES / CPA`, `DIONISIO TORRES / Oficina`, `DIONISIO TORRES / INFRA` — não casam com nenhuma sede do catálogo.

---

## 4. Datas

**Boa notícia: não há mistura de `Timestamp` com string.** Toda data no banco é string; nenhum campo veio como `timestampValue`. Os formatos por campo são consistentes:

| Campo | Formato | Exceções |
|---|---|---|
| `vagas.solicitacao` | `DD/MM/YYYY` | 403/403 — limpo |
| `vagas.conclusao` | `DD/MM/YYYY` | 293 válidas, 35 vazias |
| `vagas.etapaDesde`, `vagas.pausadaDesde` | `YYYY-MM-DD` | 1 vazia em `pausadaDesde` |
| `experiencia.*` (3 campos de data) | `DD/MM/YYYY` | 589/589 — limpo |
| `treinamentos.dataInicio` | `DD/MM/YYYY` | 173/173 |
| `treinamentos.dataTermino` | `DD/MM/YYYY` | 19 válidas + **1 fora de formato** |
| `entrevistas.dataEntrevista`, `.admissao` | `DD/MM/YYYY` | 26/26 |
| `entrevistas.desligamento` | `DD/MM/YYYY` | 25 válidas + **1 fora de formato** |
| `logs.timestamp` | ISO datetime | 871/871 |
| `integracoes.dataIntegracao` | texto livre | por design |

**Nenhuma data impossível** (dia 31/02, ano fora de 1900–2100) foi encontrada.

### O que está errado são os campos *derivados* de data ⚠️

`tempoProcesso` tem **1 valor de −46.129** e `tempoSla` tem **3 negativos** (−46.153, −46.150, −46.129). Uma diferença de ~46.100 dias equivale a ~126 anos: é a assinatura clássica de uma data vazia interpretada na época do Excel (30/12/1899) e subtraída de uma data de 2026. O registro afetado em `tempoProcesso` está `PAUSADA`, com `solicitacao` 16/04/2026 e `conclusao` vazia. Os setores atingidos em `tempoSla` são Infraestrutura, Construtora e Cota.

**Esses valores não contaminam os KPIs do dashboard**, porque tanto o KPI de tempo médio quanto o gráfico de SLA por setor filtram `tempoProcesso > 0` (`RecruitmentDashboard.tsx:194` e `:234`). Mas eles estão gravados e aparecem na tabela e na gaveta de detalhes da vaga.

O filtro `> 0` tem um custo silencioso: além do negativo, **36 vagas FECHADA têm `tempoProcesso` = 0** e também são descartadas. O KPI "tempo médio" é calculado sobre **256 das 292 vagas fechadas** e vale **32 dias** — sem que a tela diga que 36 ficaram de fora.

---

## 5. Série temporal de turnover

**A coleção tem 1 documento.** `mesAno` = `07/2026`, `totalFuncionarios` 150, `totalAdmissao` 10, `pediramSair` 8, `foramDesligados` 4.

Formato válido (`MM/YYYY`), sem duplicados, sem buracos — porque não há sequência: um ponto não forma série. Qualquer gráfico de evolução mensal de turnover, incluindo o `headcountFlowData` que faz `.slice(-6)` para pegar os últimos 6 meses, desenha **uma única coluna**.

Os `/logs` registram **189 mutações no módulo Turnover** contra 1 documento vivo — houve muito cadastro e exclusão. O dado histórico não está no banco.

---

## 6. Isolamento Colégio × Universidade

Aplicando a regra real de `utils/unidade.ts` (origem `planilha-universidade` **ou** sede em região `Universidade`):

| Recorte | Vagas |
|---|---:|
| **Universidade** | **179** |
| **Colégio** | **224** |
| Total | 403 |

Consistente: 178 vagas têm `origem = planilha-universidade` e 178 têm id `uni-*` — o mesmo conjunto. A 179ª entra pela sede (região Universidade) sem vir do sync.

**A separação funciona.** Um usuário do Colégio deve ver **224 vagas**; um da Universidade, **179**. É esse o número a conferir na tela.

Dois pontos para verificar com o RH, não corrigidos aqui:

1. **`PARQUELANDIA 3` está catalogada na região `Universidade`**, enquanto `PARQUELANDIA 1` e `PARQUELANDIA 2` estão em `Parquelândia`. Isso joga 20 vagas para o lado da Universidade. Pode estar certo (o campus existe), mas destoa das irmãs e vale confirmar.
2. **18 vagas têm sede fora do catálogo** (`d.valeria`, `cd lojinha`, `pré - sul`, `kmc2`). Sede desconhecida cai como Colégio por padrão. Nos quatro casos o destino acaba certo, mas por acidente: `d.valeria` e `pré - sul` são grafias de sedes do Colégio que existem no catálogo com outro nome; `cd lojinha` e `kmc2` não existem em lugar nenhum.

`/integracoes` está corretamente restrita: as 6 sedes presentes são todas da Universidade.

---

## 7. Achado transversal: o `lint` não protege o código de UI ⚠️

Fora do escopo de dados, mas descoberto ao validar um indicador e determinante para o critério de pronto.

**`@types/react` e `@types/react-dom` não estão instalados nem declarados no `package.json`.** React 19 não traz tipos embutidos. Consequência: `import React from 'react'` resolve para `any`, logo `React.FC<Props>` é `any`, logo **as props de todos os 30 componentes que usam `React.FC` são `any`**.

Verificado empiricamente: numa cópia de `RecruitmentDashboard.tsx`, o compilador reporta o tipo de `turnover` como `any[]` — não `Turnover[]` — e um erro proposital de atribuição na mesma cópia é detectado normalmente (o arquivo é checado; o que falta é o tipo). Em arquivo novo sem React, o mesmo acesso a propriedade inexistente é acusado com `TS2339`.

`npm run lint` (`tsc --noEmit`) passa com zero erros, mas para componentes ele está validando quase nada.

**Isso já deixou passar um bug real:** `RecruitmentDashboard.tsx:205` lê `turnover[turnover.length - 1].taxaTurnoverGeral`. Esse campo **não existe** no tipo `Turnover`, não existe em nenhum documento de `/turnover` e não é escrito em lugar nenhum do repositório. Em runtime resolve para `undefined`, o `?? 0` assume, e o KPI **"Turnover Geral" exibe 0 permanentemente**, com qualquer dado.

---

## 8. Indicadores que os dados sustentam

| Indicador | Base medida | Situação |
|---|---|---|
| Vagas por status (pizza) | 403 vagas, `status` 100%, domínio limpo | ✅ sólido |
| Total de vagas abertas / fechadas | idem | ✅ sólido |
| Motivos de abertura (`categoriaMotivo`) | 100%, 3 valores limpos | ✅ sólido |
| Tempo médio de fechamento | 256 de 292 fechadas, 32 dias | ✅ com ressalva: declarar o denominador |
| Experiência por status | 589 docs, `status` 100%, 4 valores limpos | ✅ sólido |
| Experiência — vencimentos 45/90 | `dataAdmissao`/`termino1`/`termino2` 100% e uniformes | ✅ sólido |
| Integração — cumprimento por campus | 441 docs, `status` e `sede` 100% | ✅ sólido |
| Treinamentos — horas e participantes | `cargaHoraria`, `qtdPrevista/Realizada`, `totalHorasFormacao` 100% | ✅ sólido |
| Notas das entrevistas (6 dimensões) | 26 docs, 100% preenchidos | ⚠️ sólido por campo, mas **n=26**: exibir o n junto |
| Vagas por sede | `sede` 100% | ⚠️ **só depois de canonizar as 10 colisões** |
| Funil de candidatos | 61 de 403 vagas (15,1%); 475 chamados → 110 → 26 | ⚠️ real, mas é uma **amostra de 15%** — não pode ser lido como total |
| Taxa de presença por cargo | mesmas 61 vagas | ⚠️ idem |

## 9. Indicadores que os dados **não** sustentam hoje

| Indicador | Por quê | Medida |
|---|---|---|
| **Turnover mensal / evolução** | a coleção tem **1 mês** | 1 doc |
| **"Turnover Geral" (KPI)** | campo `taxaTurnoverGeral` não existe em lugar nenhum | sempre 0 |
| **Admissões × desligamentos (últimos 6 meses)** | `.slice(-6)` sobre 1 registro | 1 coluna |
| **Tempo médio por etapa** | 59 das 111 vagas ativas caem no bucket "Triagem" por falta de etapa; só 28 têm `etapaDesde`, as outras 83 usam o tempo total em aberto como se fosse tempo de etapa | etapa 38,2% · `etapaDesde` 18,6% |
| **Motivos de desistência** | 14 vagas com valor, espalhadas em 6 categorias | 3,5% |
| **Impacto de pausas no SLA** | `diasPausados` existe em **1** documento | 0,2% |
| **Valor investido em treinamento** | 157 de 173 registros valem 0; total R$ 4.416 | 9,2% com valor |
| **Iniciativa do encerramento na experiência** | 3 registros de `tipoEncerramento` contra 139 encerrados | 0,5% |
| **Requisições de vaga (qualquer número)** | coleção vazia | 0 docs |
| **Aniversariantes / roster** | coleção vazia | 0 docs |
| **Entrevistas por origem (RH × formulário público)** | campos `origem`/`anonima` inexistentes | 0 docs |
| **"Gostava do trabalho"** | "Sim" em 26 de 26 | variância zero |
| **Experiência agrupada por setor** | 47,5% vazio e os preenchidos contêm sedes | 52,5% contaminado |
| **Auditoria por região** | `regiao` ausente em metade dos logs | 50,1% |
| **Treinamentos por tipo (5 categorias)** | só 3 dos 5 valores ocorrem | 2 categorias sempre vazias |
| **Série mensal de treinamentos** | `mesReferencia` com caixa inconsistente | 15 fatias para 12 meses |

---

## 10. Consequências diretas para a apresentação

Cada item aqui vira uma linha de justificativa para as mudanças visuais da Parte 2.

1. **Canonizar a sede antes de agrupar.** `getSedeSigla` deve casar por nome **ou** sigla, como `regiaoDaSede` já faz. Sem isso a barra do topo do gráfico de sedes está 20 vagas abaixo do real. — §3
2. **Todo indicador precisa mostrar o seu `n`.** "32 dias" sobre 256 de 292 fechadas, "notas" sobre 26 entrevistas, "funil" sobre 61 de 403 vagas. Sem o denominador, uma amostra de 15% é lida como o total. — §2, §4
3. **Estado de vazio de verdade onde a coleção está vazia.** Requisições, funcionários e a série de turnover precisam de um vazio explicativo — não de um eixo desenhado com zero ou uma coluna solitária. — §1, §5
4. **O KPI "Turnover Geral" precisa sair ou ser calculado.** Hoje é um zero fixo. Com os campos existentes (`pediramSair`, `foramDesligados`, `totalFuncionarios`) a taxa é calculável para o mês que existe. — §7
5. **"Triagem" precisa se separar de "sem etapa".** Enquanto o fallback de `normalizeEtapa` misturar os dois, o gráfico de gargalos aponta para o lugar errado. — §3
6. **Categorias com n=1 não merecem barra própria.** Motivos de saída (12 categorias / 26 registros) e motivos de desistência (14 registros) pedem agrupamento ou lista, não gráfico. — §3
7. **Instalar `@types/react` e `@types/react-dom`** antes de confiar no `npm run lint` como portão de qualidade da UI. — §7
8. **Conferir na tela:** usuário do Colégio deve somar **224** vagas; da Universidade, **179**. — §6

---

## Anexo — como reproduzir

Leitura autenticada por ADC do usuário (`gcloud auth application-default login`), sem service account e sem segredo no repositório:

```
GET https://firestore.googleapis.com/v1/projects/project-312a1a63-026e-4dfa-91c
    /databases/ai-studio-2b395015-7429-44d1-83dd-233de9cd3c47
    /documents/{colecao}?pageSize=300&pageToken=...
```

Para cada documento foram contados: presença e preenchimento por campo, histograma de tipos do wire format (é o que provaria mistura `Timestamp` × string), formato de data por regex, valores distintos de campos categóricos, e os recortes de isolamento e de série temporal. Nomes, e-mails e texto livre entraram apenas como percentual — nenhum dado pessoal foi extraído para este relatório.

---

## 11. Parte 2 — o que mudou, e a linha desta análise que justifica cada mudança

| Mudança | Onde | Justificativa |
|---|---|---|
| KPI "Turnover" passa a calcular a taxa real, com o mês ao lado e o vazio explícito quando não há mês fechado. Usa a **mesma fórmula do módulo Turnover** — `((admissões + saídas) ÷ 2) ÷ efetivo` (`TurnoverSection.tsx:108`) — para não haver dois números sob a mesma palavra | `RecruitmentDashboard.tsx`, `utils/indicadores.ts` (`taxaTurnover`, 8 testes) | §7 — lia `taxaTurnoverGeral`, campo inexistente; mostrava 0 fixo. Para 07/2026 a taxa é **7,3%** |
| Rótulo do mesmo card deixa de dizer "Baseado em N entrevistas de saída" e passa a mostrar saídas/funcionários + "todas as unidades" | `RecruitmentDashboard.tsx` | §7 e §5 — o número não vinha de entrevistas, e `/turnover` não tem sede |
| Agrupamento por sede usa sigla canônica (casa por nome **ou** sigla) | `utils/unidade.ts` (`acharSede`, `siglaCanonica`, 6 testes), `RecruitmentDashboard.tsx` | §3 — 10 colisões; DT desenhava 63 em vez de 83 |
| KPI de SLA mostra o denominador ("32 dias · 256 de 292 fechadas") | `RecruitmentDashboard.tsx` | §4 — o filtro `> 0` descarta 36 fechadas em silêncio |
| Card do funil mostra "N de M vagas registraram candidatos" | `RecruitmentDashboard.tsx` | §9 — o funil existe em 15,1% das vagas |
| Gráfico de etapas informa quantas vagas estão sem etapa gravada e sem `etapaDesde` | `RecruitmentDashboard.tsx` | §3 e §9 — 59 de 111 ativas caem em "Triagem" por fallback; só 28 têm a data |
| Todo gráfico ganha alternativa tabular (`<details>` + `<table>` com `caption`) | `components/TabelaDoGrafico.tsx` (novo), 9 gráficos | Restrição de acessibilidade do pedido — não havia `role`, `aria-label`, `sr-only` nem `<table>` em nenhum dos 10 gráficos |
| Chrome dos gráficos passa a vir dos design tokens (37 hexadecimais removidos) | `swiss.css` (2 tokens novos), `useCoresGrafico.ts`, `RecruitmentDashboard.tsx` | §10.7 e o princípio declarado no próprio `swiss.css`: eixos não acompanhavam a campanha |
| Grades tracejadas (7) viram hairlines sólidas; raio das barras uniformizado em 4px | `RecruitmentDashboard.tsx` | Regra de visualização de dados: tracejado lê como projeção/limiar; 4px é o raio do tema |
| `@types/react` e `@types/react-dom` instalados | `package.json` | §7 — o portão de lint não validava props de 30 componentes |
| `a.nome.localeCompare(b)` comparava string com objeto (ordenação de setores quebrada) | `AdminSetoresTab.tsx` | §7 — bug revelado pela instalação dos tipos |
| `vagaCodigo` recebia `number` num campo `string` | `VacancyTable.tsx` | §7 — idem |

**Não entrou nesta entrega, de propósito:** `normalizeEtapa` continua devolvendo `Triagem` como fallback. Separar "sem etapa" numa etapa própria acrescentaria uma raia ao Kanban (`VacancyTable.tsx:1310` usa a mesma função) — é mudança de comportamento, não refinamento de apresentação. O gráfico passou a declarar a incerteza em vez de escondê-la.

### Verificação

Rodados após a última alteração:

- `npm run lint` (`tsc --noEmit`) — exit 0, **agora com os tipos reais do React**
- `npm test` — **151 testes passando** em 13 arquivos (eram 138 antes: +13)
- `npm run build` — concluído sem erro
- Detector de design do `impeccable` sobre os arquivos alterados — `[]`

**Não verificado:** a conferência visual na tela logada (`npm run dev`) não foi feita — o servidor sobe e responde 200, mas a inspeção no navegador foi dispensada. Os números da tela contra o relatório (Colégio deve somar **224** vagas, Universidade **179**) seguem por conferir.
