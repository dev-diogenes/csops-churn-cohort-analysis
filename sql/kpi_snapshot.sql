-- kpi: última leitura de cada KPI por linha de cliente.
-- Cancelados: última leitura antes de dt_cancel. Ativos: leitura mais recente.
-- Nome, unidade e direção vêm de kpi_type no próprio export (não é preciso exportar kpi_type).
SELECT DISTINCT ON (k.id_customer, k.type)
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
  AND (c.dt_cancel IS NULL OR k.ref_date < c.dt_cancel)
ORDER BY k.id_customer, k.type, k.ref_date DESC;
