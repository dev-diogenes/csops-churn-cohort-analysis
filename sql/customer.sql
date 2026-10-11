-- Clientes (ativos e cancelados) com os campos usados no relatório.
-- Exporte o resultado como CSV com cabeçalho e anexe no cartão "Clientes".
SELECT
    c.id,
    c.name,
    c.dt_register,
    c.industry,
    c.size,
    c.state,
    c.stage,
    c."group",
    c.cs_owner,
    -- c.custom_fields ->> 'mrr' AS mrr,   -- descomente se o MRR estiver em custom_fields
    c.dt_cancel,
    c.cancel_tag,
    c.cancel_description
FROM customer c;
