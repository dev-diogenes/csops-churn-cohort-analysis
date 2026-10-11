-- Alternativa com histórico: uma leitura por KPI por mês (a última de cada mês), últimos 24 meses.
-- O relatório continua usando a última leitura antes do cancelamento.
SELECT DISTINCT ON (k.id_customer, k.type, date_trunc('month', k.ref_date))
    k.id_customer,
    k.type,
    k.value,
    k.ref_date,
    t.name             AS kpi_name,
    t.inv_proportional,
    t.unit
FROM kpi k
JOIN customer c ON c.id = k.id_customer
JOIN kpi_type t ON t.id = k.type
WHERE k.value IS NOT NULL
  AND t.active IS NOT FALSE
  AND k.ref_date >= now() - interval '24 months'
  AND (c.dt_cancel IS NULL OR k.ref_date < c.dt_cancel)
ORDER BY k.id_customer, k.type, date_trunc('month', k.ref_date), k.ref_date DESC;
