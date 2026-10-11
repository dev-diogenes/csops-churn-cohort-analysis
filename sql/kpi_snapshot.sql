-- Última leitura de cada KPI por cliente.
-- Cancelados: última leitura antes de dt_cancel. Ativos: leitura mais recente.
-- Gera um arquivo pequeno mesmo com o histórico diário completo na tabela kpi.
SELECT DISTINCT ON (k.id_customer, k.type)
    k.id_customer,
    k.ref_date,
    k.type,
    k.value
FROM kpi k
JOIN customer c ON c.id = k.id_customer
JOIN kpi_type t ON t.id = k.type
WHERE k.value IS NOT NULL
  AND t.active IS NOT FALSE
  AND (c.dt_cancel IS NULL OR k.ref_date < c.dt_cancel)
ORDER BY k.id_customer, k.type, k.ref_date DESC;
