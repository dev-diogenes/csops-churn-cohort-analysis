-- Nome, unidade e direção de cada KPI.
-- inv_proportional = true: valor maior é pior (ex.: tickets abertos, dias sem acesso).
SELECT id, name, unit, inv_proportional
FROM kpi_type
WHERE active IS NOT FALSE;
