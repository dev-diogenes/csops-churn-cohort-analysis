# csops-churn-cohort-analysis

A maioria das empresas SaaS rastreia churn como uma métrica única — mas nem todo churn é igual. Como saber se um churn foi "normal" ou "anormal" para aquele perfil específico de cliente?

Este repositório é um relatório de página única (`index.html`) para times de Customer Success. Você anexa ou cola os CSVs exportados das tabelas `customer` e `kpi`, e ele cruza tudo pelo ID do cliente direto no navegador. Nenhum dado sai da máquina.

## Acesse online

- Relatório: https://dev-diogenes.github.io/csops-churn-cohort-analysis/
- Painel de diagnóstico: https://dev-diogenes.github.io/csops-churn-cohort-analysis/diagnostico.html
- Roadmap do produto: https://dev-diogenes.github.io/csops-churn-cohort-analysis/docs/roadmap.html

Publicado pelo GitHub Pages a partir da branch `main`. A integração com a SenseData precisa do servidor do projeto (`node tools/servidor.mjs`) ou da Vercel; no GitHub Pages a página explica isso ao abrir Integrações → SenseData.

## Como usar

1. **Passo 1 · Sua empresa e o mercado**: informe modelo (B2B/B2C), segmento dos clientes, ARR e ticket anual (ou o câmbio, para o ticket ser calculado pelos dados). O perfil fica salvo no navegador e define as referências da seção **Mercado**.
2. **Passo 2 · Seus dados**: baixe o modelo [`modelos/modelo_churn.xlsx`](modelos/modelo_churn.xlsx) ou rode as consultas de [`sql/`](sql/), e anexe ou use **Colar** (tabela com as colunas do modelo, direto do Excel/Sheets). **Ver** reabre os dados já carregados. Depois de carregar, as fontes se recolhem numa linha de status.
3. Abra `index.html` no navegador. Ele abre com dados de exemplo fictícios, descartados no primeiro arquivo seu.

Os nomes de coluna são reconhecidos sozinhos (PT ou EN) e podem ser trocados em **Colunas** em cada cartão.

## Integração com a SenseData

No topo do relatório, **Integrações → SenseData** importa os dados direto da API v2 da SenseData (SenseConnect), informando só a URL da API e o token:

| Endpoint | O que vira no relatório |
|---|---|
| `GET /v2/me` | Teste do token (nome da plataforma e usuário) |
| `GET /v2/customers` | `customer`: id, nome, grupo econômico (`group`), organização (`cnpj`), setor, porte, UF, fase, CS, `dt_register`, `dt_cancel`, `cancel_tag`, `cancel_description` |
| `GET /v2/kpis?ref_date:start=&ref_date:end=` | Só o último dia de cada um dos últimos 12 meses fechados (uma chamada por dia). Para clientes ativos, a leitura mais recente é a do fim do mês passado |
| `GET /v2/contracts` (opcional) | MRR: soma de `monthly_payment` dos contratos vigentes hoje (ativos) ou na véspera do cancelamento |
| `GET /v2/support_tickets`, `/v2/nps`, `/v2/tasks`, `/v2/tasks_checkin`, `/v2/customers_notes`, `/v2/usage_time`, `/v2/default_usage` (opcional) | Sinais de churn dos últimos 18 meses: tickets, NPS, tarefas, visitas, notas (só a data) e uso por mês |
| `GET /v2/contracts` com sinais ligados | Contratos: `start_date`, `end_date`, `monthly_payment`, `cycle` |
| `GET /v2/contacts?is_main_sponsor=true` (opcional) | `sponsor_desde`: data de cadastro do sponsor atual, usada como estimativa de troca de decisor |

Fonte sem permissão ou sem o módulo contratado é pulada com um aviso; o resto da importação segue.

O nome, a unidade e a direção (`inv_proportional`) de cada KPI já vêm no objeto `type` de cada leitura. A paginação segue `next_page`; respostas 429 (limite de requisições) são repetidas respeitando `retry-after`. Referência: [api.sensedata.io/v2/redoc](https://api.sensedata.io/v2/redoc).

**Por que precisa de um servidor:** a API da SenseData não aceita chamadas feitas direto do navegador (não libera CORS), e o link publicado como Artifact bloqueia chamadas externas. Por isso a página chama `/api/sensedata/...` no próprio servidor do relatório, que repassa só leituras (GET), só para `https://*.sensedata.io`, com o token informado na página. O token fica na memória da aba e não é salvo.

```bash
node tools/servidor.mjs          # http://localhost:8787 com a ponte para a API real
node tools/servidor.mjs --mock   # API simulada com os dados de exemplo, para testar sem token
```

Publicando o repositório na Vercel, a função `api/sensedata/[...path].js` faz o mesmo papel da ponte local.

O token de produção do SenseConnect é pedido ao suporte da SenseData (suporte@sensedata.com.br).

## Sinais de churn e assinatura de cada motivo

Em **Dados → Sinais de churn** entram cinco fontes opcionais, com as mesmas colunas da API v2: **Tickets** (`support_tickets`), **NPS**, **Tarefas e interações** (tarefas, visitas e notas, com a coluna `kind`), **Uso** (`usage_time`, com `modules` opcional) e **Contratos** (`contracts`: início, fim, valor mensal e ciclo). Os modelos estão na planilha e em [`exemplos/`](exemplos/).

**Diagnóstico → Assinatura de cada motivo** responde por que os clientes saem:

1. No fim de cada mês, cada linha ativa recebe variáveis de uso, suporte, voz do cliente, relacionamento, indicadores e estrutura, calculadas só com registros até aquela data.
2. Quem cancelou nos 90 dias seguintes por um motivo é comparado com quem continuou ativo. Motivos com menos de 10 cancelamentos entram em "Outros".
3. A matriz mostra em que família cada motivo dá aviso; o detalhe traz os sinais, a média de quem saiu e de quem ficou, o efeito, com quantos meses de antecedência o sinal aparece e se ele se repete nas duas metades do período.

Pedidos de cancelamento, tarefas e playbooks de retenção (categoria, tipo, título, tag ou playbook com "cancel", "churn", "rescis", "retenção" ou "distrato") ficam fora das variáveis, porque são consequência da decisão. Na **ficha do cliente**, um ativo cujos sinais lembram a assinatura de um motivo (75% ou mais de semelhança em pelo menos dois sinais) recebe o aviso "Parecido com quem saiu por X". Contratos entram como variação do valor contratado, reduções, encerramentos e dias até a próxima renovação (pelo aniversário do início); a data de fim de um contrato ainda vigente nunca é lida, porque nos cancelados ela é a própria saída.

**Casos para entrevista:** abaixo da assinatura, para cada motivo, a saída que os sinais anteciparam e a que eles não viram, com o CSM de cada uma e um roteiro de 30 minutos. Roteiro completo, registro e síntese em [`docs/roteiro-entrevistas.md`](docs/roteiro-entrevistas.md).

O relatório exportado inclui `assinaturas-por-motivo.csv`, `fotos-mensais.csv` e `casos-para-entrevista.csv`. Desenho completo em [`docs/modelo-de-sinais.md`](docs/modelo-de-sinais.md).

## Tour de boas-vindas

Na primeira visita, o relatório pergunta o que a pessoa quer resolver e mostra só o que importa para o papel dela: **Agir na minha carteira** (CSM, termina na Carteira), **Entender o churn da base** (Head de CS, termina na Visão geral) ou **Ver tudo**. O tour troca de área sozinho a cada passo, com **Pular** e **Entendi**; "Explorar mais 4 seções" abre uma segunda trilha. A escolha fica salva (`csops-profile`) e define a área inicial nas próximas visitas. **Ver tour**, na barra lateral, reabre a qualquer momento.

Depois do tour, **dicas pontuais** aparecem uma por vez (ponto pulsante) em recursos ainda não usados, como exportar, abrir a ficha de um cliente, mover um cartão e salvar uma visão. Cada uma some no primeiro uso. A lista **Primeiros passos** da barra lateral acompanha o progresso (perfil, dados próprios, abrir um cliente, exportar).

## Painel de diagnóstico

Abra pelo botão **Diagnóstico de Churn ↗** no topo do relatório (ou na aba ao lado de Churn). O painel abre com os dados e o recorte que estão na tela do relatório; sem isso, mostra os dados de exemplo. "usar exemplo" no topo do painel volta aos dados de exemplo.


[`diagnostico.html`](diagnostico.html) conta a história em 7 páginas: diagnóstico, retenção (curva de sobrevivência e coortes), onde está o churn (perfis, carteira de CSM ajustada pelo mix, hierarquia e contágio no grupo), sinais (força e trajetória dos KPIs antes da saída), qualidade do score (ROC, AUC, décimos e cortes), ação e dados e método. Cada achado mostra o cálculo passo a passo.

Ele usa o mesmo motor de cálculo do relatório. Para gerar com os seus dados:

```bash
node tools/gerar_diagnostico.mjs customer.csv kpi.csv
```

## Referências de mercado

A seção **Mercado** compara o seu churn de logos mensal, a GRR dos últimos 12 meses e o churn anual de receita com:

- [SaaS Capital · 2025 B2B SaaS Retention Benchmarks](https://www.saas-capital.com/wp-content/uploads/2025/09/RB32WS1-2025-B2B-SaaS-Retention-Benchmarks.pdf): GRR e NRR medianas por ticket anual (mais de 1.000 empresas privadas B2B SaaS).
- [Optifai · B2B SaaS Churn Rate Benchmarks](https://optif.ai/learn/questions/b2b-saas-churn-rate-benchmark/): faixas de churn mensal de logos por segmento (fonte secundária).
- [CRV · SaaS churn rate](https://www.crv.com/content/saas-churn-rate): churn anual de receita mediano de empresas com ARR de US$ 1–10 milhões (dados da Lighter Capital, 2025).

Não existe hoje uma API pública e confiável com esses números por segmento ou por país; as referências ficam na constante `BENCH` de `index.html` e devem ser revisadas uma vez por ano. São de empresas majoritariamente dos EUA e não separam por setor: use como ordem de grandeza.

## Colunas

No modelo, o cabeçalho vermelho é obrigatório, o amarelo é opcional mas importante (filtros, hierarquia, comparações) e o sem cor é opcional.

| Tabela | Obrigatórias | Opcionais importantes | Opcionais |
|---|---|---|---|
| `customer` | `id`, `dt_register`, `dt_cancel` | `name`, `hierarchy_type`, `id_group`, `group`, `id_org`, `id_product`, `product`, `industry`, `size`, `state`, `stage`, `cs_owner`, `cancel_tag`, `cancel_description`, `mrr` | `mrr_12m_atras`, `cnpj`, `id_legacy`, `name_contract`, `city`, `country`, `support_owner`, `sales_owner`, `onboarding_owner`, `dt_stage` |
| `kpi` | `id_customer`, `type`, `value` | `ref_date`, `kpi_name`, `inv_proportional` | `unit` |
| cancelamentos | `id_customer`, `dt_cancel` | `cancel_tag` | `mrr_perdido` |

- Cliente com `dt_cancel` preenchido conta como cancelado. A tabela de cancelamentos só é necessária se o cancelamento não estiver em `customer`.
- `kpi_type` não precisa ser enviada: `kpi_name`, `inv_proportional` e `unit` vêm por join no próprio export de `kpi` ([`sql/kpi_snapshot.sql`](sql/kpi_snapshot.sql)). Sem elas, os KPIs aparecem como "KPI 1", "KPI 2"… e a direção é deduzida dos dados.
- Para cada linha de cliente e KPI vale a última leitura **antes** de `dt_cancel` (ativos: a mais recente). [`sql/kpi_mensal.sql`](sql/kpi_mensal.sql) traz uma leitura por mês, se quiser histórico.
- `cs_owner` e os demais campos de perfil são texto (nome do CSM, não o ID).
- `mrr_12m_atras` (MRR da linha 12 meses antes) habilita o **NRR** na seção Mercado. A importação da SenseData calcula pelos contratos vigentes naquela data.
- Separador `,` `;` ou tab; datas `AAAA-MM-DD` (com ou sem hora), `DD/MM/AAAA` ou `MM/AAAA`; números em formato BR ou US.
- Para regenerar o modelo depois de mudar colunas: `python tools/gerar_modelo.py` (requer `openpyxl`). Mantenha a constante `TEMPLATE` de `index.html` igual.

## Hierarquia e filtros

A hierarquia usa IDs: `id_group` (grupo econômico), `id_org` (organização, o próprio cliente) e `id_product` (produto contratado), com os nomes em `group`, `name` e `product`. `hierarchy_type` diz o que cada linha de `customer` representa: `grupo`, `organizacao` ou `produto`.

- Linhas de grupo ou organização que têm linhas abaixo delas só dão nome à hierarquia e não entram na contagem, para o mesmo cliente não contar duas vezes. Sem `hierarchy_type`, toda linha conta.
- **Analisar por** linha de cliente, organização ou grupo econômico. Uma organização ou grupo só conta como cancelado quando todas as suas linhas cancelaram; se só parte cancelou, entra em **churn parcial**. Organizações sem grupo contam como um grupo próprio.
- **Filtros** por qualquer hierarquia ou perfil (grupo, organização, produto, setor, porte, UF, CSM…), com vários valores por filtro. Todas as seções recalculam para o recorte.

## O que o relatório mostra

A barra lateral divide o relatório em cinco áreas, cada uma com uma pergunta (o endereço muda junto: `#inicio`, `#carteira`, `#retencao`, `#diagnostico`, `#dados`):

| Área | Seções |
|---|---|
| **Visão geral** | Principais achados; cartões com tendência de 12 meses e variação contra o mês anterior; seu churn, GRR e NRR x mercado |
| **Carteira** | Quadro de risco (A abordar, Em contato, Plano de ação, Resolvido) e Ativos em risco (score ≥ 70 alto, 55–70 atenção) |
| **Retenção** | Retenção por coorte; motivos (`cancel_tag` + `cancel_description`) e tempo de casa no cancelamento |
| **Diagnóstico** | Churn por perfil (teste z), Indicadores (d de Cohen) e Churn esperado x anormal (score < 50) |
| **Dados** | Perfil da empresa, arquivos, formato dos arquivos, método e uso neste navegador |

Textos longos ficam em **Como ler** e **Como é calculado**, abertos sob demanda. O status usa a mesma legenda em todas as áreas: ▲ crítico, ◆ atenção, ● saudável. **Visões** prontas e salvas guardam área, nível, filtros e cortes.

### Ficha do cliente e quadro de risco

Clicar no nome de qualquer cliente abre a **ficha**: score e o que puxa cada ponto dele, indicadores mês a mês, linhas (produtos) e motivo, se cancelou. Ativos podem ir para o **quadro de risco** com uma nota. Clientes em alto risco entram sozinhos em *A abordar*; os cartões se movem arrastando ou pelo seletor (teclado). Cartão parado há mais de 7 dias fica vermelho. Quadro e notas ficam neste navegador.

### Exportar relatório

**Exportar relatório** baixa um `.zip` com:

- `painel-diagnostico.html`: o painel de diagnóstico com os dados embutidos, para abrir em qualquer navegador;
- `analises/`: clientes analisados, cancelados classificados, ativos em risco, retenção por coorte, churn por perfil, indicadores, série mensal, mercado, quadro de risco e uso do relatório (CSV com `;`, vírgula decimal e UTF-8, abre direto no Excel);
- `dados/`: os arquivos de entrada como foram lidos;
- `LEIA-ME.txt`: recorte, cortes do score e o que é cada arquivo.

Nada sai do navegador para gerar o arquivo. No Artifact do claude.ai downloads são bloqueados; use a versão do GitHub Pages.

O ícone **i** ao lado de cada título resume como a análise é feita; clicando nele, abre um painel móvel com o passo a passo calculado com os dados carregados (escolha a coorte, o grupo, o KPI ou o cliente de exemplo).

### Interações

- **Cortes do score**: controles deslizantes em Churn anormal e Ativos em risco reclassificam tudo na hora (contagens, histograma, tabelas e achados).
- **Retenção por coorte**: mira de linha e coluna ao passar o mouse ou navegar com Tab; clique na célula para ver quem saiu antes daquele mês; alterna entre retenção e churn acumulado.
- **Churn por perfil**: ordene por taxa, cancelados ou MRR perdido; clique numa barra para filtrar o relatório inteiro por aquele grupo.
- **Indicadores**: clique no nome do KPI para abrir a distribuição completa de ativos e cancelados.
- **Motivos**: clique num motivo para ver os cancelamentos dele na tabela.
- **Painel de diagnóstico**: corte do score ajustável (ponto na curva ROC, precisão e acerto ao vivo), hover sincronizado nas trajetórias, ordenação e destaque nos perfis, e "Ver como tabela" em todos os gráficos.

As tabelas de churn classificado e ativos em risco podem ser copiadas como CSV.

## Dados lembrados e teste no tempo

- **Lembrar neste navegador** (ligado por padrão): os CSVs e os ajustes (colunas, filtros, nível, cortes) ficam no IndexedDB do navegador e voltam ao reabrir a página. **Esquecer dados** apaga. Nada é enviado para fora.
- **Teste no tempo do score**: recalcula o score com as leituras de KPI de 90 dias atrás, só para quem estava ativo naquela data, e mede quantos dos marcados cancelaram depois. Aparece em *Ativos em risco* e na página *O score funciona?* do painel. A direção e o peso de cada KPI são aprendidos só com os cancelamentos até aquela data; nada do período testado entra no score do teste.

## Testes

```bash
node tools/testar.mjs
```

Roda o motor do `index.html` no Node com os dados de exemplo e confere leitura de números e datas, contagens, churn, score, AUC e o teste no tempo. Rode antes de publicar mudanças no cálculo.

## Rodar localmente

Abrir o arquivo direto funciona. Para servir:

```bash
python -m http.server 8000
```
