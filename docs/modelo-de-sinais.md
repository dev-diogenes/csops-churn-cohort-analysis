# Modelo de sinais: a assinatura de cada motivo de cancelamento

**Objetivo:** entender as causas do churn. Para cada motivo de cancelamento (`cancel_tag`), descobrir quais sinais estavam diferentes nos 90 dias antes da saída e com quanta antecedência eles apareceram.

**Decisões (12/10/2026):**
- A fonte é a API v2 da SenseData, com as mesmas tabelas e colunas do export.
- O prazo é de 90 dias.
- Os motivos (`cancel_tag`) são confiáveis. Motivo com menos de 10 cancelamentos vai para "Outros".
- Só existe o sponsor atual; a troca de sponsor é estimada pela data de cadastro do contato.

## Como o modelo funciona

1. **Fotos mensais.** No último dia de cada mês (T), cada cliente ativo recebe as variáveis abaixo, calculadas **só com registros até T**.
2. **Rótulo.** O rótulo diz se o cliente cancelou entre T e T+90 dias e, se sim, por qual motivo (agrupado).
3. **Assinatura.** Para cada motivo, os clientes que saíram por ele são comparados com os que continuaram ativos na mesma foto. Para cada sinal medimos três coisas:
   - o tamanho do efeito (d de Cohen ou razão de taxas);
   - a direção;
   - a antecedência: em que mês antes da saída o sinal passa a se destacar (T−3, T−2 ou T−1).
4. **Validação.** As assinaturas são calculadas com as fotos até 6 meses atrás e conferidas nos últimos 6 meses. Sinal que não se repete fica marcado como instável.

## Fontes na API v2

| Família | Endpoint | Campos usados |
|---|---|---|
| Clientes e motivo | `GET /v2/customers` | `id`, `dt_register`, `dt_cancel`, `cancel_tag`, `cancel_description`, `size`, `industry`, `stage`, `cs`, `custom_fields` |
| Contratos | `GET /v2/contracts` | `id_customer`, `start_date`, `end_date`, `monthly_payment`, `auto_renewal`, `plan`, `status` |
| KPIs | `GET /v2/kpis` | `id_customer`, `ref_date`, `type`, `value` (já usado) |
| Uso | `GET /v2/usage_time` | `ref_date`, `active_users`, `contracted_users`, `registered_users`, `usage_time` |
| Uso por módulo | `GET /v2/default_usage` | `ref_date`, `product`, `module`, `action`, `amount` |
| Suporte | `GET /v2/support_tickets` | `created_on`, `end_date`, `expire_date`, `priority`, `category`, `type`, `status` |
| Voz do cliente | `GET /v2/nps` | `survey_date`, `score`, `role`, `respondent`, `comments`, `tags`, `nps_status` |
| Tarefas e reuniões | `GET /v2/tasks` | `type`, `status`, `due_date`, `end_date`, `id_playbook`, `contact.is_main_sponsor`, `tags` |
| Visitas | `GET /v2/tasks_checkin` | `checkin_at`, `task.customer` |
| Notas | `GET /v2/customers_notes` | `created_on` (só contagem; o texto não sai do navegador) |
| Sponsor | `GET /v2/contacts` | `is_main_sponsor`, `is_active`, `created_at`, `updated_at` |

Todos os endpoints aceitam filtro de data e paginação (`limit`, `page`, `next_page`). Passam pelo mesmo proxy só de leitura (GET) que a integração já usa.

## Variáveis (em cada foto T)

**Uso**
- `uso_licencas`: usuários ativos ÷ contratados; `uso_licencas_d3`: variação contra a média dos 3 meses anteriores
- `uso_tempo_d3`: variação do tempo de uso contra a média dos 3 meses anteriores
- `uso_modulos_30d` e `uso_modulos_d3`: módulos distintos usados no mês e a variação
- Para cada KPI: nível, `d3` (contra a própria média), inclinação em 3 meses e `parado` (sem leitura no mês)

**Suporte**
- `tk_90d` e `tk_razao`: tickets nos últimos 90 dias ÷ nos 90 anteriores
- `tk_alta_90d`: tickets de prioridade alta ou urgente
- `tk_abertos_T`, `tk_vencidos_T`: abertos em T; abertos além do `expire_date`
- `tk_resolucao_med`: mediana de dias até `end_date`
- `tk_categoria_top`: categoria dominante (entra na leitura da assinatura, não no score)

**Voz do cliente**
- `nps_ultima`, `nps_delta` (última − anterior), `nps_detrator` (≤ 6)
- `nps_dias_sem_resposta`, `nps_sponsor_respondeu` (pelo `role` ou contato sponsor)

**Relacionamento**
- `rel_dias_ultima_tarefa`: dias desde a última tarefa concluída; `rel_dias_ultima_reuniao` (tipos de tarefa de reunião)
- `rel_tarefas_atrasadas_T`: `due_date` < T sem `end_date` até T
- `rel_visitas_90d`, `rel_notas_90d`, `rel_playbooks_90d`
- `sp_sem_sponsor`: nenhum contato ativo marcado como sponsor
- `sp_novo`: sponsor atual cadastrado há menos de 180 dias (estimativa de troca)

**Estrutura e contrato**
- Tempo de casa e `ct_dias_fim`: dias até o fim do contrato vigente; `ct_auto_renovacao`
- `ct_mrr_d90`: variação do MRR dos contratos vigentes em 90 dias; `ct_produtos_perdidos_90d`
- Perfil: porte, setor, etapa, CSM (para comparar com pares, como o score atual)

## Cuidados contra resultado enganoso

- **Nada depois de T.** Isso vale também para o `dt_cancel`: a foto em que o cliente já saiu não entra.
- **Registros da própria saída ficam de fora.** Tickets, tarefas e playbooks cujo tipo, categoria, tag ou playbook contenha "cancel", "churn", "rescis" ou "retenção" não contam (a lista é editável). Eles são consequência da decisão, não sinal antecipado.
- **O histórico de CSM não existe na API.** Só existe o CSM atual, então troca de CSM fica fora.
- **A troca de sponsor é estimada.** `sp_novo` usa a data de cadastro do contato, não um histórico de troca.
- **Comentários de NPS e notas não são lidos como texto.** Entram só as tags e as contagens, e o texto fica no navegador.

## O que aparece no relatório

- **Diagnóstico → Assinaturas por motivo:** tabela de motivos × sinais com o efeito, a direção, a antecedência (T−3, T−2, T−1) e a estabilidade.
- **Ficha do cliente:** quando os sinais de um ativo lembram a assinatura de um motivo, aparece "parecido com quem saiu por X", com os 3 sinais que mais pesam.
- **Exportar relatório:** `assinaturas-por-motivo.csv` e `fotos-mensais.csv` (uma linha por cliente × mês com todas as variáveis).

## Etapas

| Semana | Entrega |
|---|---|
| 1 | Importação SenseData das novas fontes, com o progresso no modal atual, e modelos de CSV para quem não usa a API; dados de exemplo com os mesmos sinais |
| 2 | Fotos mensais e variáveis, com testes de regressão |
| 3 | Assinaturas por motivo, validação temporal e seção em Diagnóstico |
| 2–4 | Entrevistas com 6 CSMs, 2 cancelamentos do mesmo motivo cada (um previsto pela assinatura e um não) |
| 4 | Sinais confirmados nas entrevistas viram regra da ficha do cliente |
