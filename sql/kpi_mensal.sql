-- Alternativa com histórico: uma leitura por KPI por mês (a última de cada mês),
-- limitada aos últimos 24 meses. O relatório continua usando a última antes do cancelamento.
SELECT DISTINCT ON (k.id_customer, k.type, date_trunc('month', k.ref_date))
    k.id_customer,
    k.ref_date,
    k.type,
    k.value
FROM kpi k
JOIN customer c ON c.id = k.id_customer
WHERE k.value IS NOT NULL
  AND k.ref_date >= now() - interval '24 months'
  AND (c.dt_cancel IS NULL OR k.ref_date < c.dt_cancel)
ORDER BY k.id_customer, k.type, date_trunc('month', k.ref_date), k.ref_date DESC;
