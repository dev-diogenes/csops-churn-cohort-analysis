-- Perfil de qualidade das tabelas customer, kpi e kpi_type (PostgreSQL).
-- Rode bloco a bloco; cada consulta responde uma pergunta do diagnóstico.

-- 1. Tamanho e período --------------------------------------------------------
SELECT count(*)                                   AS linhas,
       count(DISTINCT cnpj)                       AS organizacoes,
       count(DISTINCT "group")                    AS grupos,
       min(dt_register), max(dt_register),
       count(*) FILTER (WHERE dt_cancel IS NOT NULL) AS cancelados,
       min(dt_cancel), max(dt_cancel)
FROM customer;

SELECT count(*) AS linhas, count(DISTINCT id_customer) AS clientes, count(DISTINCT type) AS tipos,
       min(ref_date), max(ref_date),
       pg_size_pretty(pg_total_relation_size('kpi')) AS tamanho
FROM kpi;

-- 2. Completude dos campos que o relatório usa ----------------------------------
SELECT round(100.0 * count(*) FILTER (WHERE dt_register IS NULL) / count(*), 1) AS pct_sem_dt_register,
       round(100.0 * count(*) FILTER (WHERE "group" IS NULL OR "group" = '') / count(*), 1) AS pct_sem_grupo,
       round(100.0 * count(*) FILTER (WHERE cnpj IS NULL OR cnpj = '') / count(*), 1) AS pct_sem_cnpj,
       round(100.0 * count(*) FILTER (WHERE industry IS NULL OR industry = '') / count(*), 1) AS pct_sem_industry,
       round(100.0 * count(*) FILTER (WHERE size IS NULL OR size = '') / count(*), 1) AS pct_sem_size,
       round(100.0 * count(*) FILTER (WHERE stage IS NULL OR stage = '') / count(*), 1) AS pct_sem_stage,
       round(100.0 * count(*) FILTER (WHERE dt_cancel IS NOT NULL AND (cancel_tag IS NULL OR cancel_tag = '')) / nullif(count(*) FILTER (WHERE dt_cancel IS NOT NULL), 0), 1) AS pct_cancel_sem_tag
FROM customer;

-- 3. Consistência de cancelamento ----------------------------------------------
-- status x dt_cancel: descobre quais códigos de status significam cancelado
SELECT status, count(*) AS linhas,
       count(*) FILTER (WHERE dt_cancel IS NOT NULL) AS com_dt_cancel
FROM customer GROUP BY status ORDER BY status;

SELECT count(*) FILTER (WHERE dt_cancel < dt_register)                         AS cancel_antes_do_inicio,
       count(*) FILTER (WHERE dt_cancel > current_date)                        AS cancel_no_futuro,
       count(*) FILTER (WHERE dt_cancel IS NULL AND cancel_tag IS NOT NULL)    AS tag_sem_cancelamento,
       count(*) FILTER (WHERE abs(dt_register - created_at::date) > 30)        AS registro_difere_de_created_at
FROM customer;

-- 4. Dimensões: cardinalidade e grafias diferentes do mesmo valor --------------
SELECT 'industry' AS campo, industry AS valor, count(*) FROM customer GROUP BY 1, 2
UNION ALL SELECT 'size', size, count(*) FROM customer GROUP BY 1, 2
UNION ALL SELECT 'stage', stage, count(*) FROM customer GROUP BY 1, 2
UNION ALL SELECT 'cancel_tag', cancel_tag, count(*) FROM customer GROUP BY 1, 2
ORDER BY 1, 3 DESC;

SELECT 'industry' AS campo, lower(trim(industry)) AS normalizado, count(DISTINCT industry) AS grafias
FROM customer GROUP BY 1, 2 HAVING count(DISTINCT industry) > 1;

-- 5. cs_owner: concentração no valor padrão (DEFAULT 2) ------------------------
SELECT cs_owner, count(*) AS linhas, round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM customer GROUP BY cs_owner ORDER BY linhas DESC LIMIT 10;

-- 6. Hierarquia: linhas por organização e organizações por grupo ---------------
SELECT linhas_por_org, count(*) AS organizacoes
FROM (SELECT cnpj, count(*) AS linhas_por_org FROM customer WHERE cnpj IS NOT NULL GROUP BY cnpj) t
GROUP BY 1 ORDER BY 1;

-- mesma organização em mais de um grupo (hierarquia inconsistente)
SELECT cnpj, count(DISTINCT "group") AS grupos
FROM customer WHERE cnpj IS NOT NULL GROUP BY cnpj HAVING count(DISTINCT "group") > 1;

-- 7. kpi: duplicidade, buracos e leituras após o cancelamento -------------------
SELECT count(*) AS duplicados
FROM (SELECT id_customer, type, ref_date::date FROM kpi GROUP BY 1, 2, 3 HAVING count(*) > 1) d;

SELECT t.id, t.name, t.active, t.aggregate, t.is_portfolio, t.inv_proportional, t.depends_on,
       count(k.*) AS leituras, count(DISTINCT k.id_customer) AS clientes,
       round(100.0 * count(*) FILTER (WHERE k.value IS NULL) / nullif(count(k.*), 0), 1) AS pct_nulo,
       min(k.value), percentile_cont(0.5) WITHIN GROUP (ORDER BY k.value) AS mediana, max(k.value),
       max(k.ref_date) AS ultima_leitura
FROM kpi_type t LEFT JOIN kpi k ON k.type = t.id
GROUP BY t.id ORDER BY leituras DESC;

SELECT count(*) AS leituras_apos_cancelamento
FROM kpi k JOIN customer c ON c.id = k.id_customer
WHERE c.dt_cancel IS NOT NULL AND k.ref_date >= c.dt_cancel;

-- dias sem cálculo nos últimos 90 dias (falhas no job diário)
SELECT d::date AS dia
FROM generate_series(current_date - 90, current_date - 1, interval '1 day') d
WHERE NOT EXISTS (SELECT 1 FROM kpi WHERE ref_date::date = d::date);

-- 8. custom_fields: quais chaves existem e com que frequência -------------------
SELECT key, count(*) AS clientes
FROM customer, jsonb_object_keys(custom_fields) AS key
GROUP BY key ORDER BY clientes DESC;
