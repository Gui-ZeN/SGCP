---
name: SGPC — Sistema de Gestão de Pessoas Christus
description: Estrutura familiar de sistema de trabalho (menu lateral, quadro, tabela, modal) com tinta azul-noite sobre papel e cor que só fala de estado.
colors:
  tinta: "#141B2D"
  tinta-2: "#3B4560"
  tinta-3: "#5D6782"
  tinta-placeholder: "#737C93"
  fio: "#DCDFE5"
  fio-campo: "#C9CDD6"
  fio-hover: "#AEB4C1"
  fio-interno: "#EEF0F3"
  papel: "#FFFFFF"
  papel-hover: "#F6F7F9"
  papel-cabecalho: "#FAFAFB"
  chao: "#ECEDF0"
  superficie: "#ECEEF2"
  tinta-hover: "#26304A"
  atraso: "#B4331F"
  atraso-fundo: "#FBE9E5"
  etapa-triagem: "#8A6A1F"
  etapa-triagem-fundo: "#F5EEDC"
  etapa-entrevista: "#2B5EA7"
  etapa-entrevista-fundo: "#E5EDF8"
  etapa-testes: "#6A4BA0"
  etapa-testes-fundo: "#EEE8F6"
  etapa-documentacao: "#1F7A6B"
  etapa-documentacao-fundo: "#E0F1EC"
  etapa-admissao: "#2E7D3A"
  etapa-admissao-fundo: "#E3F2E4"
  etapa-pausa: "#5D6782"
  etapa-pausa-fundo: "#ECEEF2"
  menu-fundo: "#13213F"
  menu-texto: "#D3DAE8"
  menu-suave: "#8E9BBA"
  menu-selo: "#F2B33D"
typography:
  pagina-titulo:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  numero:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
  modal-titulo:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  titulo:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
  corpo:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
    fontFeature: "'tnum' 1"
  controle:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.3
  rotulo:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
  apoio:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "12px"
    fontWeight: 500
rounded:
  etiqueta: "4px"
  pequeno: "6px"
  controle: "7px"
  painel: "8px"
  modal: "10px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.corpo}"
    rounded: "{rounded.controle}"
    padding: "0 16px"
    height: "40px"
  button-hover:
    backgroundColor: "{colors.papel-hover}"
  button-primario:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.controle}"
    padding: "0 16px"
    height: "40px"
  button-primario-hover:
    backgroundColor: "{colors.tinta-hover}"
  button-sm:
    rounded: "{rounded.pequeno}"
    padding: "0 10px"
    height: "32px"
  button-perigo:
    textColor: "{colors.atraso}"
  button-perigo-hover:
    backgroundColor: "{colors.atraso-fundo}"
  seg-ativo:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    typography: "{typography.controle}"
    padding: "0 14px"
    height: "38px"
  chip:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta-2}"
    typography: "{typography.controle}"
    rounded: "{rounded.controle}"
    padding: "0 13px"
    height: "36px"
  campo:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.controle}"
    rounded: "{rounded.controle}"
    padding: "0 12px"
    height: "36px"
  painel:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.painel}"
    padding: "20px"
  cartao-vaga:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.painel}"
    padding: "12px 13px"
  modal:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.modal}"
    padding: "18px 20px"
  etiqueta-atraso:
    backgroundColor: "{colors.atraso-fundo}"
    textColor: "{colors.atraso}"
    rounded: "{rounded.etiqueta}"
    padding: "1px 7px"
  link-vaga:
    backgroundColor: "{colors.etapa-entrevista-fundo}"
    textColor: "{colors.etapa-entrevista}"
    rounded: "{rounded.etiqueta}"
    padding: "1px 6px"
  menu-item-ativo:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.menu-fundo}"
    rounded: "{rounded.pequeno}"
    padding: "0 11px"
    height: "32px"
---

# Design System: SGPC

## Overview

**Creative North Star: "A Mesa do RH"**

O SGPC é onde o RH do Grupo Christus passa o dia: abre vaga, conduz seleção, lança candidato, decide a experiência. As usuárias não são técnicas, então o rework de outubro/2026 escolheu **estrutura familiar** (menu lateral, quadro Kanban, tabela, modal no meio da tela, botão que diz o que faz) e pôs a identidade nos detalhes: o menu azul-marinho institucional, a tinta azul-noite no lugar do preto, a régua do funil e as cores de etapa que atravessam o sistema inteiro.

A cor não enfeita. Ela tem significado fixo (atraso, etapa, feito, pendente) e é a mesma em todas as telas. A campanha sazonal (Setembro Amarelo, Outubro Rosa) pinta o menu e o acento dos gráficos, nunca o significado. A tela-alvo é o notebook do escritório (1366×768, também 1024); celular não é alvo.

As telas novas são feitas com as classes próprias de `src/styles/ui.css` e `src/styles/casca.css`. O `src/styles/swiss.css` é a camada legada do tema "Suíço", que ainda remapeia utilitários Tailwind (`bg-slate-*`, `rounded-*`, `shadow-*`) das telas que não migraram. Está em retirada: não é sistema, não recebe regra nova e não serve de modelo.

**Key Characteristics:**
- Estrutura que a usuária já conhece; identidade no menu, na tinta e nas cores de etapa.
- Cor com significado fixo, igual em todas as telas e imune à campanha.
- Public Sans com números tabulares em todo o sistema.
- Papel branco com fio de 1px; sombra só no que se move (cartão arrastável, modal, menu aberto, painel de filtro).
- Cabe no notebook: nada rola de lado, o menu não rola.

## Colors

Tinta azul-noite sobre papel branco e chão cinza-claro, com um conjunto fechado de cores de estado e de etapa.

### Primary
- **Tinta Azul-Noite** (`{colors.tinta}`): texto principal, botão primário, opção ativa do controle segmentado, chip marcado, aba ativa. Faz o papel de acento sem ser cor de campanha. Hover do primário em `{colors.tinta-hover}`.

### Secondary
- **Marinho do Menu** (`{colors.menu-fundo}`): fundo do menu lateral e da barra do topo em tela estreita. Texto em `{colors.menu-texto}` (11,6:1), rótulo de grupo em `{colors.menu-suave}` (5,6:1).
- **Selo Âmbar** (`{colors.menu-selo}`): célula do logo, contador no item do menu, avatar e anel de foco dentro do menu. Só existe no menu.

### Tertiary: cores de etapa do funil
Cada etapa tem cor e fundo: **Triagem** (`{colors.etapa-triagem}`), **Entrevista** (`{colors.etapa-entrevista}`), **Testes** (`{colors.etapa-testes}`), **Documentação** (`{colors.etapa-documentacao}`), **Admissão** (`{colors.etapa-admissao}`), **Pausa** (`{colors.etapa-pausa}`), cada uma com o par `-fundo` para coluna e etiqueta. Fonte única: `corEtapa`/`fundoEtapa` em `CartaoVaga.tsx`.

Duas delas também carregam estado fora do funil: o verde de Admissão quer dizer **feito / entrou / bom**; o âmbar de Triagem quer dizer **pendente / pediu para sair / atenção** (é o `tom` do `Kpi`). O azul de Entrevista é também a cor dos atalhos entre telas (`.atalho`, `LinkVaga`).

### Neutral
- **Papel** (`{colors.papel}`): painéis, cartões, campos, modal. Hover de linha e item em `{colors.papel-hover}`; cabeçalho de tabela e rodapé de modal em `{colors.papel-cabecalho}`.
- **Chão** (`{colors.chao}`): fundo da área de conteúdo. Fonte única: `--chao` em `ui.css` (o legado `--sgpc-canvas` só repassa).
- **Superfície** (`{colors.superficie}`): trilho de barra, etiqueta neutra, sigla da sede no cartão, campo desabilitado.
- **Tinta 2** (`{colors.tinta-2}`, 9,6:1): texto de apoio, rótulo de Kpi, chip em repouso.
- **Tinta 3** (`{colors.tinta-3}`, 5,8:1): rótulo, meta, cabeçalho de tabela, linha `.sub`, trilha da página. Placeholder em `{colors.tinta-placeholder}`.
- **Fio** (`{colors.fio}`): borda de painel e divisor. **Fio de campo** (`{colors.fio-campo}`): borda de botão, chip, campo, controle segmentado; no hover sobe para `{colors.fio-hover}`. **Fio interno** (`{colors.fio-interno}`): divisor entre linhas de tabela e seções de modal.

### Named Rules
**The Fixed Meaning Rule.** Cada cor tem um significado e só um, em todas as telas: `{colors.atraso}` é atraso ou desligado; as cores de etapa são a etapa do funil, as mesmas no Kanban, na régua e nos Indicadores; verde (`{colors.etapa-admissao}`) é feito/entrou; âmbar (`{colors.etapa-triagem}`) é pendente/pediu para sair. Cor nova de estado não se inventa: usa-se uma destas.

**The Campaign Paints The Menu Rule.** A campanha (`data-campanha`) troca só a família `--menu-*` (fundo, texto, suave, selo) e o acento dos gráficos (`--sgpc-acento`, lido por `useCoresGrafico`). Atraso, etapas, tinta, papel, anel de foco, seleção de texto e o acento das telas antigas (`--sgpc-ui`, em `swiss.css`) nunca mudam com campanha: status precisa continuar legível.

**The One Red Rule.** `{colors.atraso}` é o único vermelho. Vale para prazo estourado, desligamento, ação destrutiva (`.btn-perigo`, remover nome) e erro de formulário (`.erro-form`).

## Typography

**Fonte:** Public Sans (com system-ui, sans-serif), da página ao número da tabela.
**Mono:** JetBrains Mono, só para dado de máquina (id, código, linha de log).

**Character:** uma grotesca institucional e neutra; a hierarquia vem de tamanho e peso. O corpo inteiro usa `tabular-nums`. A Public Sans entrou no lugar da Schibsted Grotesk escolhida no mockup porque o `tnum` da Schibsted dava à vírgula a largura de um dígito ("4 , 5"). Antes de trocar a fonte, meça a vírgula com `tnum`.

### Hierarchy
- **Título de página** (700, 30px, 1.1, -0.015em): um por tela, no `.pagina-cab`, com a trilha (13px, Tinta 3) acima.
- **Número** (700, 28px, 1, tabular): o valor do `Kpi`. Variações maiores no Início e nos temas dos Indicadores (32px); menores na lista "Em números" (18px).
- **Título de modal** (700, 20px, 1.25).
- **Título** (700, 15px, 1.3): título de painel (`.ind-titulo`), de seção de modal, de cartão de lista. O título do cartão de vaga usa 15px; o da coluna do quadro, 14,5px.
- **Corpo** (500, 14px): texto corrido, célula, item de lista. Tabela em 13,5px.
- **Controle** (600, 13,5px): chip, campo, opção do controle segmentado. Botão em 14px (primário 700), botão pequeno e botão de texto em 13px.
- **Rótulo** (600, 13px): rótulo de campo (`.rotulo`), rótulo de Kpi, título de tema.
- **Apoio** (500, 12,5px): descrição sob título, `.sub`, `.ajuda`, meta, cabeçalho de tabela (600). Etiqueta e `LinkVaga` em 12px 700. Nada abaixo de 11px na interface; 11,5px só no menu.

### Named Rules
**The Plain Label Rule.** Rótulo por extenso, em pt-BR, em caixa normal. Nada de caixa-alta pequena decorativa, sobrelinha ("eyebrow") acima do título ou abreviação que a usuária precise decifrar. O que vai acima do título é a trilha da página ou a linha `.modal-antes` (número, situação), em caixa normal.

**The Number Needs A Noun Rule.** Todo número grande vem com o rótulo do que é e, quando existe, o denominador (`detalhe` do `Kpi`: "de 41 fechadas").

## Layout

Casca de duas colunas: menu lateral de 240px à esquerda e conteúdo à direita sobre o Chão, com 24px de respiro (32px a partir de 1024px). A página começa pelo `.pagina-cab`: trilha e título à esquerda, ações à direita (alinhadas pela base, quebram para baixo). Depois vêm os filtros numa linha (`.filtros`, 8px entre peças, a busca empurrada para a direita), e então o conteúdo. Dentro de painel o respiro é 20px; entre blocos, 12–16px.

**Tela-alvo: 1366×768, também 1024.** Com as barras do navegador sobram ~620px de altura; tudo é medido para isso. Celular não é alvo: abaixo de 1024px o menu vira gaveta com barra no topo, só para não quebrar.

- **Quadro (Kanban):** colunas em grade de largura igual (`--colunas`, padrão 5), que encolhem até caber; abaixo de 960px viram uma coluna só. Cada coluna rola por dentro, nunca o quadro de lado.
- **Tabela:** ocupa a largura do painel. Para caber, junta colunas e põe o detalhe numa 2ª linha `.sub`; colunas de número usam `.num-col` (estreita, à direita, tabular). Se mesmo assim não couber, usa `.tabela-empilha`: abaixo de 900px cada linha vira um cartão, com o rótulo vindo de `data-rotulo`.
- **Grade de cartões:** `repeat(auto-fill, minmax(300px, 1fr))`, 14px de vão.
- **Modal:** larguras 440 / 640 / 860px (`sm`/`md`/`lg`), altura até a tela menos 48px, corpo rolando por dentro.

### Named Rules
**The No Sideways Scroll Rule.** Nenhuma tabela, quadro ou página rola na horizontal no notebook (1366 e 1024). Junte colunas (detalhe em `.sub`) ou use `.tabela-empilha`. O desenho do organograma encolhe cada setor para caber (zoom até 60%); só um setor com mais de ~7 supervisores lado a lado ainda rola dentro da própria folha, como último recurso.

**The Menu Never Scrolls Rule.** O menu lateral não rola na vertical. Em tela baixa ele aperta (item de 32 → 29 → 27px; abaixo de 600px de altura os títulos de grupo somem). A partir de 1024px pode ficar recolhido em 64px, só ícones, e abre por cima do conteúdo ao passar o mouse ou receber foco, sem empurrar a página.

## Elevation & Depth

Plano em repouso: a profundidade vem de papel branco sobre o Chão e do fio de 1px. Sombra existe só no que sai do plano ou se move.

### Shadow Vocabulary
- **Cartão do quadro** (`0 1px 2px rgba(16,24,40,.08), 0 0 0 1px rgba(16,24,40,.04)`; no hover `0 2px 8px rgba(16,24,40,.1), 0 0 0 1px rgba(16,24,40,.1)`): cartão de vaga, que se arrasta entre colunas.
- **Painel suspenso** (`0 8px 24px rgba(16,24,40,.14)`): o painel de opções do `FiltroMultiplo`.
- **Modal** (`0 24px 60px rgba(10,16,32,.3)`) sobre véu `rgba(15,23,42,.5)`.
- **Menu aberto por cima** (`10px 0 30px rgba(10,16,32,.28)`): o menu recolhido quando se expande.

### Named Rules
**The Flat Unless Lifted Rule.** Painel, tabela, Kpi e cartão de lista ficam planos, com fio. Sombra só para o que está por cima de outra coisa ou pode ser arrastado.

## Shapes

Cantos suaves e em degraus por tamanho: 4px para etiqueta e `LinkVaga`; 6px para botão pequeno, item de menu e opção de filtro; 7px para botão, chip, campo, controle segmentado e erro de formulário; 8px para painel, cartão e cartão empilhado; 10px para coluna do quadro e modal. Barras (régua, trilho, barra fina) têm 2–3px. Etapa vazia na régua e coluna vazia no quadro usam contorno tracejado. Círculo só para avatar e ponto de conexão.

## Components

### Buttons
Discretos e explícitos: o rótulo diz o que acontece ("Concluir a vaga", "Registrar decisão").
- **Padrão** (`.btn`): papel com fio de campo, 40px de altura, 7px, ícone de 16px opcional à esquerda. Hover: papel mais escuro e fio mais forte, 150ms.
- **Primário** (`.btn-primario`): fundo Tinta, texto branco, 700. Um por área.
- **Pequeno** (`.btn-sm`): 32px, 6px, 13px.
- **Texto** (`.btn-texto`): sem caixa, Tinta 2, 700, sublinha no hover. Ações secundárias dentro de cartão e rodapé de filtro.
- **Perigo** (`.btn-perigo`): texto em Atraso; no hover, fundo Atraso-fundo.
- **Avançar etapa** (no cartão de vaga): botão cheio na cor da próxima etapa (verde para "Concluir a vaga").
- **Foco:** anel de 2px com 1px de afastamento em todo elemento, na tinta (`--sgpc-ui`), igual em qualquer campanha (no menu, o anel é o Selo).

### Controle segmentado e abas
- **Segmentado** (`.seg`): botões colados num contorno de fio de campo, 38px; o ativo (`aria-pressed`) fica em Tinta cheia com texto branco. Troca de recorte ou visão, com a contagem de cada opção ("Pendentes 4 / Histórico 31", "Em experiência / Efetivados / Encerrados").
- **Abas** (`.abas`): sublinhado de 2px em Tinta na aba ativa (`aria-selected`), nunca em cor de campanha. Temas dos Indicadores.

### Filtros (FiltroMultiplo)
- **Chip** (`.chip`): rótulo + resumo em negrito do que está marcado ("Sede: BN, AL" ou "BN +2"; nada marcado mostra "todos"). Marcado: contorno duplo em Tinta.
- **Painel:** 260px, busca no topo, lista de caixas de seleção (até 260px, rola por dentro), rodapé com "Limpar". Fecha no Esc e clicando fora.
- **Busca de texto** (`.campo-busca`): campo com lupa, até 320px, no fim da linha de filtros.

### Inputs / Fields
- **Campo** (`.campo`): papel, fio de campo, 7px, 36px de altura, 13,5px. Hover fortalece o fio. `textarea.campo` com 72px mínimos. `.campo-sel` para select; desabilitado vai para Superfície.
- **Rótulo** (`.rotulo`, 13px 600, Tinta) acima; **ajuda** (`.ajuda`, 12,5px, Tinta 3) abaixo.
- **Erro** (`.erro-form`): caixa em Atraso-fundo com texto Atraso 600, nomeando o problema.
- **Lista de nomes** (`ListaDeNomes`): um campo por nome, numerado, com botão de remover que fica vermelho no hover.

### Cards / Containers
- **Painel** (`.painel`, componente `Painel`): papel, fio, 8px, 20px de respiro; título (15px 700) e descrição curta, ações à direita.
- **Kpi:** painel compacto (14×16px) com rótulo, número de 28px colorido pelo `tom` (neutro, bom = verde, atenção = âmbar, crítico = Atraso) e detalhe.
- **Cartão de lista** (`.cartao-item` em `.grade-cartoes`): linha de contexto, título 15,5px, meta, ações de texto separadas por fio.
- **Barra fina** (`.barra-fina`, 6px) e **ListaComBarra**: proporção escrita em número, com a barra só de apoio.

### Tabela
- `.tabela`: 13,5px, cabeçalho 12,5px 600 em Tinta 3 sobre `{colors.papel-cabecalho}`, células 10×14px, divisor `{colors.fio-interno}`, hover de linha. Ordenação por botão no cabeçalho. `.sub` para o detalhe sob o valor principal; `.num-col` para número. `.paginacao` no rodapé.

### Modal
- `Modal` (`ui/Modal.tsx`): sempre no meio da tela, sobre véu escuro; entra em 160–180ms (desligado com `prefers-reduced-motion`). Cabeçalho com linha `.modal-antes` opcional, título de 20px e X de 36px; corpo rola por dentro; rodapé com ações à direita sobre `{colors.papel-cabecalho}`. Fecha no X, no Esc e clicando fora; o Esc fecha só o de cima da pilha; a página de trás não rola; o foco volta para quem abriu.
- **Ficha** (`.ficha`): dados em grade de 2 colunas, rótulo (12,5px) em cima e valor (14,5px 600) embaixo. **Seção** (`.secao`): blocos separados por fio, com título de 15px.
- **Opção de decisão** (`.opcao-decisao`): opção grande (rádio + título + explicação); a marcada ganha contorno duplo em Tinta. Usada no modal "Registrar decisão" da Experiência.

### Navigation
- **Menu lateral** (`MenuLateral`): Marinho, 240px, itens agrupados por área com título de grupo em Menu Suave (11,5px, caixa normal). Item: ícone de 18px + nome, 32px de altura; hover em branco translúcido; ativo (`aria-current="page"`) vira pílula branca com texto Marinho 700. Contador do item no Selo. Rodapé com avatar, nome e "Sair"; o ponto do avatar é verde (sincronizando) ou âmbar (modo local).
- **Recolhido:** o menu continua com 240px e um `clip-path` mostra só 64px; abrir anima o recorte (180ms, 120ms de atraso para não abrir de raspão), e o contador fica preso ao ícone.

### Atalhos entre telas
- `.atalho`: texto em azul de Entrevista, sublinhado claro que escurece no hover.
- `LinkVaga` (`.link-vaga`): "nº 124" em etiqueta azul de Entrevista, que abre `#/vagas?vaga=124`. Endereços sempre por `linkPara` em `src/lib/rotas.ts`, para que o Voltar, o F5 e o abrir em outra aba funcionem.

### Régua do funil (assinatura)
`ReguaFunil`: frase-resumo ("**3 de 41 vagas** passaram da meta de 15 dias na etapa · 2 pausadas"), com a contagem de atraso em Atraso; abaixo, uma barra de segmentos de 10px na cor de cada etapa, proporcional à contagem (etapa vazia vira contorno tracejado), e a legenda com o número de cada etapa. A mesma no Quadro de Vagas e no Início, onde a régua inteira é um link.

### Cartão de vaga (assinatura)
`CartaoVaga`: sigla da sede em etiqueta e código no topo; título (15px 700, clicável); setor; contratado em verde; prazo na etapa com trilho de 4px e o número em Atraso quando passou da meta; botão de avançar na cor da próxima etapa e ações de texto (Pausar…). Pausada: fundo `#FAFAF8` e texto apagado.

## Do's and Don'ts

### Do:
- **Do** montar tela nova com as classes de `src/styles/ui.css` e `casca.css` e os componentes de `src/components/ui/` (Modal, FiltroMultiplo, ListaDeNomes, Atalhos) e `indicadores/ui.tsx` (Painel, Kpi, ListaComBarra, useEixos).
- **Do** fazer todo filtro de múltipla escolha com `FiltroMultiplo`, nada marcado = todos. Exceção consciente: Ano e Mês dos Indicadores são período e têm escolha única, porque os gráficos são mês a mês de um ano.
- **Do** caber em 1366×768 e em 1024 sem rolagem lateral: juntar colunas com `.sub`, `.num-col` ou `.tabela-empilha`.
- **Do** abrir todo detalhe, formulário e confirmação no `Modal` centralizado.
- **Do** usar cor só pelo significado fixo: Atraso para atraso/desligado, cor de etapa para etapa, verde para feito/entrou, âmbar para pendente/pediu para sair, e sempre com texto junto.
- **Do** marcar vaga como atrasada só pelo critério único `vagaAtrasada` (`utils/vaga.ts`): mais de 15 dias na mesma etapa, pausada não conta.
- **Do** pedir confirmação em modal antes de ação destrutiva ou de decisão sobre pessoas (ex.: "Registrar decisão" da Experiência, com `.opcao-decisao`).
- **Do** transformar em link tudo que o sistema já sabe (vaga, seleção, dia, pessoa), com `LinkVaga`/`Atalho` e `linkPara`.
- **Do** escrever rótulo por extenso em pt-BR e dar a cada número grande o seu rótulo e denominador.
- **Do** manter transições em 150–250ms, desligar com `prefers-reduced-motion` e manter os gráficos sem animação.

### Don't:
- **Don't** usar gaveta lateral para detalhe ou formulário; o modal é sempre centralizado.
- **Don't** fazer o menu rolar na vertical nem empurrar o conteúdo ao abrir.
- **Don't** deixar tabela rolar de lado no notebook.
- **Don't** usar filtro de escolha única fora do período dos Indicadores.
- **Don't** deixar a campanha tocar em cor de estado, de etapa ou de atraso; ela pinta só o menu e o acento dos gráficos.
- **Don't** criar uma cor nova para estado nem um segundo vermelho.
- **Don't** pôr rótulo em caixa-alta pequena decorativa ou sobrelinha acima de título.
- **Don't** construir com utilitários remapeados pelo `swiss.css` (`bg-slate-*`, `rounded-*`, `shadow-*`) nem criar token `--sgpc-*` novo: é camada legada em retirada.
- **Don't** pôr sombra em painel, tabela ou Kpi parados.
