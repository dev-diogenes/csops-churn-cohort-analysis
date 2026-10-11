-- customer: uma linha por linha de cliente (ativos e cancelados).
-- Obrigatórias: id, dt_register, dt_cancel. As demais são opcionais (veja modelos/modelo_churn.xlsx).
-- Exporte como CSV com cabeçalho e anexe no cartão "Clientes".
SELECT
    c.id,
    c.dt_register,
    c.dt_cancel,
    c.name,
    c."group",                                -- hierarquia: grupo econômico
    c.cnpj,                                   -- hierarquia: organização
    -- c.custom_fields ->> 'produto' AS product, -- hierarquia: produto, se cada produto for uma linha
    c.industry,
    c.size,
    c.state,
    c.stage,
    c.cs_owner,                               -- troque pelo nome do CSM (join com a tabela de usuários), ex.: u.name AS cs_owner
    c.cancel_tag,
    c.cancel_description
    -- , c.custom_fields ->> 'mrr' AS mrr
FROM customer c;
