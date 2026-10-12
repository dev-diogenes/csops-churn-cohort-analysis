# Design system

Tokens e componentes do relatório (`index.html`) e do painel (`diagnostico.html`). Todos ficam em `:root` no início do `<style>`; componentes nunca usam cor, raio ou sombra literal.

Referências: padrões de produtos de CS e de gestão de trabalho (SenseData e monday.com), adaptados. Nada de marca, logo ou nome deles é usado.

| Padrão de referência | Como entrou aqui |
|---|---|
| Navegação lateral escura com áreas fixas (SenseData) | `.sidenav` em `--nav-bg`, item ativo com barra violeta |
| Saúde do cliente como cor forte e única por linha (SenseData) | barra de score e rótulo usam os mesmos `--st-*` e os cortes do usuário |
| Rótulos de status preenchidos dentro da tabela (monday) | `.chip.crit/.warn/.good/.neu` sólidos, com ícone de forma |
| Cartões brancos com sombra leve sobre fundo frio (ambos) | `--surface` + `--sh-1` + `--r-lg` sobre `--bg` |
| Abas segmentadas tipo "pílula" (monday) | `.seg` com o botão ativo em superfície elevada |

## Tokens

**Cor (claro / escuro)**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | #f5f6fa | #12142a | fundo da página |
| `--surface` | #ffffff | #1b1e38 | cartões, tabelas, modais |
| `--sunken` | #eceef5 | #252946 | cabeçalho de tabela, hover |
| `--ink` / `--muted` / `--faint` | #1f2240 / #565b78 / #5f6485 | #eceefa / #a9adc8 / #9095b2 | texto |
| `--line` / `--ctl` | #dfe2ec / #8a8fa8 | #2f3352 / #737896 | bordas; borda de controles |
| `--accent` | #5b4fe0 | #9d94ff | ação primária, seleção, foco |
| `--nav-bg` | #1d2140 | #0d0f22 | barra lateral |
| `--s-ativo` / `--s-canc` | #2a78d6 / #eb6834 | #3987e5 / #d95926 | séries dos gráficos |
| `--st-crit` | #d1344a (texto branco, 4,9:1) | igual | Alto risco, anormal, pior que a referência |
| `--st-warn` | #fdab3d (texto `#1f2240`, 8,1:1) | igual | Atenção, sinais fracos |
| `--st-good` | #00875a (texto branco, 4,6:1) | igual | Saudável, esperado, melhor que a referência |
| `--st-neu` | #c9ccda (texto `#1f2240`) | igual | Sem dado |

Status nunca depende só da cor: cada rótulo tem ícone de forma (▲ ◆ ●) e texto.

**Tipo**: Figtree (texto e títulos), JetBrains Mono (IDs, código, contadores). Escala `--fs-xs` 12 · `--fs-sm` 13 · `--fs-base` 15 · `--fs-md` 17 · `--fs-lg` 22 · `--fs-xl` 28 px.

**Forma**: `--r-sm` 4 (rótulos) · `--r` 8 (botões, campos) · `--r-lg` 12 (cartões, modais) · `--r-pill` (chips de filtro).
**Profundidade**: `--sh-1` cartões · `--sh-2` menus e toasts · `--sh-3` modais e tour.
**Espaço**: `--sp-1..6` = 4, 8, 12, 16, 24, 32 px.

## Componentes

| Componente | Variantes | Estados |
|---|---|---|
| `.btn` | `primary`, padrão, `ghost`, `sm` | hover, foco, `disabled` |
| `.chip` (status) | `crit`, `warn`, `good`, `neu` | só leitura |
| `.tile` (KPI) | padrão, `hl` (faixa crítica no topo); sparkline + delta opcionais | — |
| `.panel` | — | — |
| `.seg` (abas segmentadas) | — | `aria-pressed` |
| `.area` (navegação) | — | hover, `on` (`aria-current="page"`) |
| `.check` (primeiros passos) | — | item `done` |
| `.fchip` (filtro) | — | aberto/fechado |
| `.xp` (painel "Como é calculado") | — | arrastável |
| `.pm` (modal) | colar dados, SenseData, boas-vindas | — |

## Regras

1. Cor nova entra como token em `:root` e nos dois blocos escuros, nunca direto no componente.
2. Texto sobre fundo de status usa o `--st-*-ink` correspondente.
3. Uma cor de série nunca é reaproveitada como status, e vice-versa.
4. Contraste mínimo: 4,5:1 para texto, 3:1 para bordas de controle.
