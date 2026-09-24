---
name: SGPC — Sistema de Gestão de Pessoas Christus
description: Tema Suíço — a prancheta de trabalho do RH, em grade, fio fino e um só azul.
colors:
  cobalto: "#1B4DD8"
  cobalto-forte: "#1740B0"
  cobalto-borda: "#C9D6F6"
  cobalto-tint: "#EAEFFC"
  cobalto-tint-suave: "#F0F4FD"
  canvas: "#ECEDF0"
  papel: "#FFFFFF"
  tinta: "#1A1B1F"
  tinta-secundaria: "#45474D"
  tinta-suave: "#5F6169"
  hairline: "#DDE0E6"
  fio-forte: "#CAD5E2"
  superficie: "#E3E5EA"
  fio-de-campo: "#D8D7D1"
  sucesso: "#059669"
  sucesso-forte: "#047857"
  alerta: "#D97706"
  alerta-forte: "#B45309"
  erro: "#E11D48"
  erro-forte: "#BE123C"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.011em"
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.011em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.35
  number:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontFeature: "'tnum' 1, 'ss01' 1"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
    fontFeature: "'tnum' 1, 'ss01' 1"
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
  nota:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.35
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "12px"
    fontWeight: 500
rounded:
  controle: "4px"
  painel: "6px"
  pilula: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    typography: "{typography.title}"
    rounded: "{rounded.painel}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#1E293B"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-secundaria}"
    typography: "{typography.title}"
    rounded: "{rounded.painel}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.superficie}"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.controle}"
    padding: "8px 12px"
  panel:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.painel}"
    padding: "20px"
  nav-item-active:
    backgroundColor: "{colors.cobalto}"
    textColor: "{colors.papel}"
    rounded: "{rounded.painel}"
    padding: "8px 12px"
  segmented-active:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.controle}"
    padding: "6px 12px"
---

# Design System: SGPC

## Overview

**Creative North Star: "A Prancheta do RH"**

O SGPC é a ferramenta em que o RH do Grupo Christus passa o dia: abre vaga, conduz seleção, lança candidato, cobra avaliação de experiência. O visual existe para sair da frente do trabalho, como uma prancheta bem organizada: grade, fio fino, um só azul e números alinhados. Quem abre a tela deve achar o que precisa em segundos e seguir o dia.

O sistema é uma camada de re-skin (`src/styles/swiss.css`, sob `html[data-theme="swiss"]`), que é o tema único. Ela remapeia as classes utilitárias do Tailwind para tokens `--sgpc-*`. Toda cor nova entra como token nesse arquivo, nunca como hexadecimal solto num componente. É isso que permite que uma campanha (Setembro Amarelo) troque o acento inteiro num bloco só.

O Suíço veio substituir três coisas, que não voltam: o SaaS genérico colorido (uma cor por módulo, gradiente, bolha desfocada, texto com gradiente), o painel feito de cartões iguais (ícone + número grande + rótulo como estrutura da página) e a planilha crua (tudo em tabela cinza, sem hierarquia).

**Key Characteristics:**
- Um acento só (cobalto), usado para estado e ação, nunca para enfeite.
- Hairline de 1px no lugar de sombra para desenhar a grade.
- Hanken Grotesk com números tabulares em todo o sistema.
- Cantos discretos: 4px nos controles, 6px nos painéis.
- Cor semântica (verde, âmbar, vermelho) só quando informa um estado.

## Colors

A paleta é quase monocromática, papel e tinta sobre um chão cinza frio, com um único azul que marca onde agir.

### Primary
- **Cobalto** (`{colors.cobalto}`): o acento único. Aparece no item selecionado do menu, no foco dos campos, nos links de ação e no número de uma frente "de hoje". O hover e o pressionado usam o **Cobalto Forte**; os fundos de destaque usam o **Tint** e o **Tint Suave**; as bordas de destaque usam a **Borda Cobalto**.

### Neutral
- **Chão** (`{colors.canvas}`): o fundo da aplicação e do menu lateral.
- **Papel** (`{colors.papel}`): painéis, cartões, cabeçalho e campos.
- **Tinta** (`{colors.tinta}`): texto principal e o botão principal.
- **Tinta Secundária** (`{colors.tinta-secundaria}`): valor e rótulo de apoio sobre papel (8.9:1).
- **Tinta Suave** (`{colors.tinta-suave}`): texto de apoio e ticks de eixo (6.2:1).
- **Fio** (`{colors.hairline}`): a linha de 1px de painéis, divisores e bordas.
- **Fio Forte** (`{colors.fio-forte}`): o fio que precisa aparecer, como os conectores do organograma e o polegar da barra do menu.
- **Superfície** (`{colors.superficie}`): preenchimento neutro sutil (trilho de controle segmentado, hover de botão fantasma).
- **Fio de Campo** (`{colors.fio-de-campo}`): a borda dos inputs, selects e textareas.

### Semantic
- **Sucesso** (`{colors.sucesso}`, texto em `{colors.sucesso-forte}`): concluído, efetivado, dentro do prazo.
- **Alerta** (`{colors.alerta}`, texto em `{colors.alerta-forte}`): perto de vencer, fora do prazo.
- **Erro** (`{colors.erro}`, texto em `{colors.erro-forte}`): vencido, crítico, excluir. `rose` e `red` apontam para o mesmo token.

### Named Rules
**The One Voice Rule.** Existe um azul e ele significa "aqui". Cor decorativa (roxo, ciano, rosa, laranja da marca antiga) é remapeada para o cobalto pelo `swiss.css`; não se cria outra.

**The Campaign Rule.** Campanha troca a família inteira do acento (base, forte, borda e tints), nunca só a base. Sucesso, alerta e erro não mudam com campanha: status precisa continuar legível.

**The Status Is Earned Rule.** Verde, âmbar e vermelho só aparecem quando carregam um estado e vêm sempre com texto ("venceu há 4 dias"), nunca sozinhos.

## Typography

**Body Font:** Hanken Grotesk (com system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono (com monospace). Só para dado de máquina: códigos, ids, e-mails de usuário e linhas de log (`font-mono`), nunca como enfeite "técnico".

**Character:** uma grotesca só, do título ao número da tabela. A hierarquia vem de tamanho e peso, não de uma segunda família. Os números são tabulares no sistema inteiro (`'tnum' 1, 'ss01' 1` no `body`), para que as colunas alinhem sem esforço.

### Hierarchy
- **Display** (700, 34px, 1.2): a saudação do Início e o título de página; um por tela.
- **Headline** (700, 16px, 1.4): o título de um painel grande ("Para hoje", "Em números").
- **Title** (700, 14px, 1.35): o título de painel e de bloco (o `Painel` dos Indicadores), os botões e os nomes em lista.
- **Number** (700, 28px, 1, tabular): o número-chave (Kpi, contagem de frente), sempre com um rótulo que diga do que é.
- **Body** (500, 14px, 1.5): texto corrido e células.
- **Label** (600, 12px): rótulo de campo, meta de linha e legenda. **Nota** (500, 11px): o degrau mais baixo, para notas, ressalvas e o cargo e a meta do cartão do organograma. Nada abaixo de 11px.

### Named Rules
**The No Eyebrow Rule.** Nenhum rótulo em caixa alta acima de um título. O título fala sozinho; a data e o contexto vão abaixo dele ou ao lado.

**The Number Needs A Noun Rule.** Todo número grande vem com o rótulo e, quando existe, o denominador ("de 41 fechadas", "245 convocados").

## Layout

Grade de 12 colunas no conteúdo principal, com o menu lateral fixo à esquerda. A página é uma pilha de blocos com 24px (`space-y-6`) entre eles. Dentro de um painel, o respiro é de 20px (`p-5`) e os grupos ficam a 12px (`gap-3`). Páginas de tarefa usam a divisão 8 + 4: o conteúdo principal à esquerda e o apoio (números, datas) à direita, empilhando abaixo de `lg` (1024px). Filtros ficam numa linha acima do que filtram. No celular (375px) não pode haver rolagem lateral: listas longas truncam a meta, nunca o nome.

Listas densas (candidatos, seleções) seguem a planilha: linha de ~33px, cabeçalho fixo, grade entre colunas e edição na própria linha.

## Elevation & Depth

Quase plano. A profundidade vem da troca de tom (chão cinza, painel branco) e do fio de 1px, não de sombra. Onde a marcação pede sombra, o `swiss.css` troca o brilho difuso antigo por uma sombra curta e nítida, para o cartão se soltar do chão sem parecer flutuar.

### Shadow Vocabulary
- **Cartão** (`--sgpc-sombra-cartao`: `0 1px 2px rgba(15, 23, 42, .05), 0 2px 8px -2px rgba(15, 23, 42, .06)`): a única sombra do sistema, aplicada a qualquer `shadow-*` e ao cartão do organograma. CSS próprio usa o token, nunca o valor.

### Named Rules
**The Hairline Over Shadow Rule.** Separar é trabalho do fio (`{colors.hairline}`). Sombra nova, brilho colorido ou gradiente não entram: o `swiss.css` zera `bg-gradient-*` e remove os orbs desfocados.

## Shapes

Os cantos são discretos e em dois tamanhos: 4px para controles (input, select, botão pequeno, célula) e 6px para painéis e cartões (todo `rounded-lg` a `rounded-3xl` vira 6px). Círculos continuam círculos (avatar, ponto de status). Painel grande leva sempre o fio de 1px. Barra de rolagem é reta e no tom do papel.

## Components

### Buttons
Discretos e firmes: o botão principal é preto, e nada na tela salta mais do que o conteúdo.
- **Shape:** 6px nos botões de página, 4px nos compactos.
- **Primary:** fundo Tinta, texto Papel, 14px 600, com padding de 10×16px. Há um botão principal por área.
- **Hover / Focus:** o fundo passa para um grafite azulado (`hover:bg-slate-800`, que não é remapeado pelo `swiss.css`), em 150–200ms e só com `transition-colors`. O foco é um contorno cobalto de 2px com 1px de afastamento, em qualquer elemento.
- **Ghost:** texto em Tinta Secundária, sem fundo; no hover, fundo Superfície. Serve para Cancelar e ações secundárias.
- **Link de ação:** texto de 12px 600, sublinhado quando é navegação ("Ver todas as 71 →", "Candidatos").

### Chips / Controle segmentado
- **Style:** trilho em Superfície com 4px de padding interno; a opção ativa ganha fundo Papel e sombra de cartão, e as inativas ficam em Tinta Secundária. Serve para recortes como Todas / Geral / Pedagógico e para as abas dos Indicadores.
- **State:** `aria-pressed` na opção ativa.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** Papel sobre o Chão.
- **Shadow Strategy:** fio de 1px; sombra só a de cartão, quando marcada.
- **Border:** Fio, 1px.
- **Internal Padding:** 20px; o cabeçalho do painel fica separado do corpo por um fio.

### Inputs / Fields
- **Style:** fundo Papel, borda de 1px em Fio de Campo, 4px, texto de 14px.
- **Focus:** contorno cobalto de 2px.
- **Error / Disabled:** o erro aparece como lista `role="alert"` em fundo Erro Tint, com o texto nomeando o problema e a saída; o campo desabilitado fica com opacidade reduzida e o valor visível.
- **Célula de planilha** (`.celula-planilha`): sem borda parada, com fio no hover e acento ao editar. Serve para grades de centenas de linhas.

### Navigation
- **Menu lateral** no tom do Chão, com ícones monocromáticos que herdam a cor do texto. O item ativo tem fundo Cobalto e texto Papel. Os itens são agrupados por área (Recrutamento, Pessoas…).

### Lista de frentes (Início)
A página "Para hoje": cada frente é uma linha da grade com o número grande colorido pelo estado, o título, uma frase e até 4 itens clicáveis. O "quando" fica alinhado à direita e colorido pelo mesmo estado. A frente só aparece quando tem item.

## Do's and Don'ts

### Do:
- **Do** declarar toda cor nova como token `--sgpc-*` em `src/styles/swiss.css` e usá-la por `var()`.
- **Do** usar o cobalto só para estado, seleção e ação, e cor semântica só com texto junto.
- **Do** separar blocos com o fio de 1px (`{colors.hairline}`) e o respiro de 20–24px.
- **Do** manter os números tabulares e dar a cada número grande o seu rótulo e o denominador.
- **Do** desligar a animação dos gráficos (`isAnimationActive={false}`) e manter as transições de interface em 150–250ms.

### Don't:
- **Don't** usar gradiente, texto com gradiente, bolha desfocada ou uma cor por módulo (o SaaS genérico colorido que o Suíço substituiu).
- **Don't** montar a página como uma grade de cartões iguais de ícone + número + rótulo.
- **Don't** cair na planilha crua: toda tela tem hierarquia (título, o que pede ação, depois o resto).
- **Don't** pôr rótulo em caixa alta acima de um título, nem borda colorida lateral acima de 1px em cartão, item ou alerta.
- **Don't** criar um segundo azul: `info` é o próprio cobalto.
