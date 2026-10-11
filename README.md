# csops-churn-cohort-analysis

A maioria das empresas SaaS rastreia churn como uma métrica única — mas nem todo churn é igual. Como saber se um churn foi "normal" ou "anormal" para aquele perfil específico de cliente?

Este repositório é um relatório de página única (`index.html`) para times de Customer Success. Você anexa ou cola os CSVs exportados das tabelas `customer`, `kpi` e `kpi_type`, e ele cruza tudo pelo ID do cliente direto no navegador. Nenhum dado sai da máquina.

## Como usar

1. Rode as consultas de [`sql/`](sql/) e exporte cada resultado como CSV com cabeçalho.
2. Abra `index.html` no navegador. Ele abre com dados de exemplo fictícios.
3. Anexe ou cole cada CSV no cartão correspondente. Os dados de exemplo são descartados no primeiro arquivo seu.

Cada pessoa pode exportar só os campos principais. Os nomes de coluna são reconhecidos sozinhos (PT ou EN) e podem ser trocados em **Colunas** em cada cartão.

| Cartão | Tabela | Mínimo | Recomendado |
|---|---|---|---|
| **Clientes** | `customer` | `id`, `dt_register`, `dt_cancel` | `name`, `cancel_tag`, `cancel_description`, `industry`, `size`, `state`, `stage`, `group`, `cs_owner`; `mrr` opcional |
| **Indicadores** | `kpi` | `id_customer`, `type`, `value` | `ref_date` |
| **Tipos de KPI** | `kpi_type` | — (opcional) | `id`, `name`, `unit`, `inv_proportional` |
| **Cancelamentos** | — (opcional) | `id_customer`, `dt_cancel` | `cancel_tag`; só se o cancelamento não estiver em `customer` |

- Cliente com `dt_cancel` preenchido conta como cancelado; os demais, ativos.
- Para cada cliente e KPI vale a última leitura **antes** de `dt_cancel` (ativos: a mais recente). A tabela `kpi` tem histórico diário, então prefira [`sql/kpi_snapshot.sql`](sql/kpi_snapshot.sql), que já entrega só essa leitura. [`sql/kpi_mensal.sql`](sql/kpi_mensal.sql) traz uma leitura por mês, se quiser histórico.
- `inv_proportional = true` indica que valor maior é pior. Sem `kpi_type`, os KPIs aparecem como "KPI 1", "KPI 2"… e a direção é deduzida dos dados.
- Colunas de texto (ou IDs inteiros como `cs_owner`) com poucos valores distintos viram perfis de comparação. Contatos, endereço, `custom_fields` e datas são ignorados.
- Separador `,` `;` ou tab; datas `AAAA-MM-DD` (com ou sem hora), `DD/MM/AAAA` ou `MM/AAAA`; números em formato BR ou US.
- Arquivos modelo em [`exemplos/`](exemplos/), no mesmo formato das consultas.

## O que o relatório mostra

1. **Resumo**: base, ativos, cancelados, churn mensal médio (cancelamentos ÷ meses-cliente), MRR perdido, tempo mediano até cancelar.
2. **Retenção por coorte**: safras por trimestre (ou mês) de `dt_register` × meses de vida, contando só clientes que já chegaram em cada mês.
3. **Churn por perfil**: taxa por setor, porte, UF, CSM etc., com teste z contra a média da base.
4. **Ativos x cancelados**: distribuição de cada KPI e tamanho de efeito (d de Cohen). KPIs que se comportam ao contrário do `inv_proportional` configurado são sinalizados e ficam fora do score.
5. **Churn esperado x anormal**: score de risco 0–100 por cliente, calculado como percentil ponderado dos KPIs contra ativos do mesmo grupo de pares (porte, por padrão). Cancelado com score < 50 = churn anormal.
6. **Ativos em risco**: ativos com score ≥ 70 (alto) ou 55–70 (atenção), com os KPIs que puxam o risco.
7. **Motivos** (`cancel_tag` + `cancel_description`) e **tempo de casa** no cancelamento.

As tabelas de churn classificado e ativos em risco podem ser copiadas como CSV para planilha.

## Rodar localmente

Abrir o arquivo direto funciona. Para servir:

```bash
python -m http.server 8000
```
