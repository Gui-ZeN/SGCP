# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Principal:** analistas e coordenadores do RH do Grupo Christus (Fortaleza/CE), do Colégio e da Universidade. Usam o sistema no computador do escritório, o dia inteiro, como ferramenta de trabalho: abrir e acompanhar vagas, conduzir seleções, lançar candidatos, acompanhar experiência (45/90 dias), treinamentos, entrevistas de desligamento, turnover e o relato "Meu dia".
- **Diretoria** (quem pediu o relatório foi o Murilo; os demais diretores recebem): não entra no sistema no dia a dia. Recebe o e-mail das 18h, com o relato de cada pessoa do RH.
- **Gestores das unidades:** só preenchem a requisição pública de vaga (`/requisicao`), sem login.
- Perfis de acesso: Administrador, Coordenador (admin regional do Colégio), Analista, Visualizador (só leitura).

## Product Purpose

Tirar a gestão de pessoas e o recrutamento do RH das planilhas e pôr num sistema único. O sistema dá certo quando:

- **as planilhas acabam:** o RH lança tudo no sistema, e QUANTI, seleções e controle de vagas deixam de ser a fonte;
- **a diretoria fica informada sem precisar pedir:** o que o RH fez e como estão os números chegam sozinhos;
- **nada fica para trás:** prazo de vaga, avaliação de experiência e seleção sem resultado aparecem antes de virar problema.

## Operating Context

- Rotina de seleções: agendar, conduzir, lançar quem veio (candidatos por nome) e ligar a seleção à vaga aberta que ela atende. O funil da vaga soma as seleções ligadas.
- Relato diário: cada pessoa do RH preenche o "Meu dia", e o log das ações vira frases no e-mail das 18h.
- Os indicadores precisam bater com o dashboard Excel que o RH usava. Desde 23/09/2026 a fonte é o sistema.
- Idioma pt-BR; fuso America/Fortaleza.

## Capabilities and Constraints

- React 19 + TypeScript + Vite + Tailwind v4 no front; Firestore (banco nomeado) com a segurança nas Firestore Rules, não só no cliente; funções Vercel em `api/`; Vitest.
- Log de auditoria só de acréscimo (append-only), que também alimenta o relato do dia.
- Termos da casa: vaga, seleção, convocados/compareceram/ausentes/desistiram/contratados, planilha Geral × Pedagógico (vem do setor da vaga), SLA de vaga, experiência 45/90 dias, requisição, sede (sigla), Resumo do Dia, "Meu dia".
- Ainda sem tela: cadastro de funcionários / aniversariantes (só a base existe).

## Brand Commitments

- Nome: SGPC — Sistema de Gestão de Pessoas Christus, com o logo em monograma de grade 2×2 (PNG + SVG).
- Enfeites sazonais ligados pelo admin (bandeirinhas de São João, Setembro Amarelo).

## Evidence on Hand

- Dados reais no Firestore: vagas (inclusive 2025), seleções de 2026 sincronizadas com a planilha, 991 candidatos de 2026 importados só para consulta.
- Planilhas de origem do RH (Seleções 2026, Dashboard Executivo R&S 2026) ficam fora do repositório.

## Product Principles

1. **Número honesto.** O que não tem registro aparece como "sem registro", nunca como 0; estimativa vem sempre marcada como estimativa, com a origem dita.
2. **Colégio e Universidade separados.** Quem é do Colégio nunca vê nem soma dados da Universidade.
3. **O que pede ação vem primeiro.** Pendência com prazo aparece antes de virar atraso; a tela responde "o que faço agora" antes de "como estão os números".
4. **Um lugar só.** Se a informação já está no sistema (vaga, cargo, setor), a próxima tela puxa dela, em vez de pedir que se digite de novo.

## Accessibility & Inclusion

A interface já foi auditada contra as Web Interface Guidelines (labels associados, aria-live, foco e teclado). Não há um padrão formal (WCAG) exigido pelo cliente.
