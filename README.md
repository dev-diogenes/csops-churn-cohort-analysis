# csops-churn-cohort-analysis

A maioria das empresas SaaS rastreia churn como uma métrica única — mas nem todo churn é igual. Como saber se um churn foi "normal" ou "anormal" para aquele perfil específico de cliente?

Este repositório é um relatório de página única (`index.html`) para times de Customer Success. Você anexa ou cola os CSVs exportados das tabelas `customer` e `kpi`, e ele cruza tudo pelo ID do cliente direto no navegador. Nenhum dado sai da máquina.

## Como usar

1. **Passo 1 · Sua empresa e o mercado**: informe modelo (B2B/B2C), segmento dos clientes, ARR e ticket anual (ou o câmbio, para o ticket ser calculado pelos dados). O perfil fica salvo no navegador e define as referências da seção **Mercado**.
2. **Passo 2 · Seus dados**: baixe o modelo [`modelos/modelo_churn.xlsx`](modelos/modelo_churn.xlsx) ou rode as consultas de [`sql/`](sql/), e anexe ou use **Colar** (tabela com as colunas do modelo, direto do Excel/Sheets). **Ver** reabre os dados já carregados. Depois de carregar, as fontes se recolhem numa linha de status.
3. Abra `index.html` no navegador. Ele abre com dados de exemplo fictícios, descartados no primeiro arquivo seu.

Os nomes de coluna são reconhecidos sozinhos (PT ou EN) e podem ser trocados em **Colunas** em cada cartão.

## Painel de diagnóstico

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
| `customer` | `id`, `dt_register`, `dt_cancel` | `name`, `hierarchy_type`, `id_group`, `group`, `id_org`, `id_product`, `product`, `industry`, `size`, `state`, `stage`, `cs_owner`, `cancel_tag`, `cancel_description`, `mrr` | `cnpj`, `id_legacy`, `name_contract`, `city`, `country`, `support_owner`, `sales_owner`, `onboarding_owner`, `dt_stage` |
| `kpi` | `id_customer`, `type`, `value` | `ref_date`, `kpi_name`, `inv_proportional` | `unit` |
| cancelamentos | `id_customer`, `dt_cancel` | `cancel_tag` | `mrr_perdido` |

- Cliente com `dt_cancel` preenchido conta como cancelado. A tabela de cancelamentos só é necessária se o cancelamento não estiver em `customer`.
- `kpi_type` não precisa ser enviada: `kpi_name`, `inv_proportional` e `unit` vêm por join no próprio export de `kpi` ([`sql/kpi_snapshot.sql`](sql/kpi_snapshot.sql)). Sem elas, os KPIs aparecem como "KPI 1", "KPI 2"… e a direção é deduzida dos dados.
- Para cada linha de cliente e KPI vale a última leitura **antes** de `dt_cancel` (ativos: a mais recente). [`sql/kpi_mensal.sql`](sql/kpi_mensal.sql) traz uma leitura por mês, se quiser histórico.
- `cs_owner` e os demais campos de perfil são texto (nome do CSM, não o ID).
- Separador `,` `;` ou tab; datas `AAAA-MM-DD` (com ou sem hora), `DD/MM/AAAA` ou `MM/AAAA`; números em formato BR ou US.
- Para regenerar o modelo depois de mudar colunas: `python tools/gerar_modelo.py` (requer `openpyxl`). Mantenha a constante `TEMPLATE` de `index.html` igual.

## Hierarquia e filtros

A hierarquia usa IDs: `id_group` (grupo econômico), `id_org` (organização, o próprio cliente) e `id_product` (produto contratado), com os nomes em `group`, `name` e `product`. `hierarchy_type` diz o que cada linha de `customer` representa: `grupo`, `organizacao` ou `produto`.

- Linhas de grupo ou organização que têm linhas abaixo delas só dão nome à hierarquia e não entram na contagem, para o mesmo cliente não contar duas vezes. Sem `hierarchy_type`, toda linha conta.
- **Analisar por** linha de cliente, organização ou grupo econômico. Uma organização ou grupo só conta como cancelado quando todas as suas linhas cancelaram; se só parte cancelou, entra em **churn parcial**. Organizações sem grupo contam como um grupo próprio.
- **Filtros** por qualquer hierarquia ou perfil (grupo, organização, produto, setor, porte, UF, CSM…), com vários valores por filtro. Todas as seções recalculam para o recorte.

## O que o relatório mostra

O menu **Churn** agrupa as seções (novos tópicos entram como abas ao lado):

1. **Resumo**: base, ativos, cancelados, churn mensal médio, MRR perdido, tempo mediano até cancelar, churn parcial.
2. **Retenção por coorte**: safras de `dt_register` × meses de vida.
3. **Churn por perfil**: taxa por grupo com teste z contra a média.
4. **Indicadores**: KPIs de ativos x cancelados e tamanho de efeito (d de Cohen). KPIs que contrariam o `inv_proportional` ficam fora do score.
5. **Churn anormal**: score de risco 0–100 contra pares do mesmo perfil. Cancelado com score < 50 = churn anormal.
6. **Ativos em risco**: score ≥ 70 (alto) ou 55–70 (atenção), com os KPIs que puxam o risco.
7. **Motivos** (`cancel_tag` + `cancel_description`) e tempo de casa no cancelamento.

O ícone **i** ao lado de cada título resume como a análise é feita; clicando nele, abre um painel móvel com o passo a passo calculado com os dados carregados (escolha a coorte, o grupo, o KPI ou o cliente de exemplo).

### Interações

- **Cortes do score**: controles deslizantes em Churn anormal e Ativos em risco reclassificam tudo na hora (contagens, histograma, tabelas e achados).
- **Retenção por coorte**: mira de linha e coluna ao passar o mouse ou navegar com Tab; clique na célula para ver quem saiu antes daquele mês; alterna entre retenção e churn acumulado.
- **Churn por perfil**: ordene por taxa, cancelados ou MRR perdido; clique numa barra para filtrar o relatório inteiro por aquele grupo.
- **Indicadores**: clique no nome do KPI para abrir a distribuição completa de ativos e cancelados.
- **Motivos**: clique num motivo para ver os cancelamentos dele na tabela.
- **Painel de diagnóstico**: corte do score ajustável (ponto na curva ROC, precisão e acerto ao vivo), hover sincronizado nas trajetórias, ordenação e destaque nos perfis, e "Ver como tabela" em todos os gráficos.

As tabelas de churn classificado e ativos em risco podem ser copiadas como CSV.

## Rodar localmente

Abrir o arquivo direto funciona. Para servir:

```bash
python -m http.server 8000
```
