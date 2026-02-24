# Modelo de dados – Demo Automobilístico

Catálogo Unity Catalog: `leticia_demo_automobilistic_1_catalog.default`

Referência das tabelas disponíveis para a Visão Pós-venda, dashboards e APIs.

---

## Vendas (realizado)

### sales_br_by_region_monthly
Vendas mensais agregadas por região.

| Coluna         | Tipo    |
|----------------|---------|
| data_ref       | date    |
| regiao         | string  |
| vendas_total   | bigint  |

### sales_br_by_store_monthly
Vendas mensais por loja.

| Coluna       | Tipo  |
|--------------|-------|
| store_id     | int   |
| year_month   | date  |
| sales_monthly| bigint|

### sales_br
Transações (granularidade por venda).

| Coluna          | Tipo    |
|-----------------|---------|
| transaction_id  | int     |
| transaction_date| timestamp|
| product_id      | int     |
| store_id        | int     |
| quantity        | int     |
| unit_price      | double  |
| total_amount    | double  |
| payment_method  | string  |
| is_holiday      | boolean |
| day_of_week     | int     |
| month          | int     |
| customer_id     | string  |

---

## Previsões

### sales_br_forecast_qty_by_region_monthly
Previsão de quantidade de vendas por região (mensal).

| Coluna          | Tipo     |
|-----------------|----------|
| data_ref        | timestamp|
| regiao          | string   |
| vendas_previstas | double   |

### sales_br_forecast_qty_by_store_monthly
Previsão de quantidade de vendas por loja (mensal).

| Coluna         | Tipo     |
|----------------|----------|
| store_id       | int      |
| year_month     | timestamp|
| sales_forecast | double   |

### sales_br_forecast_seasonal_peaks
Picos sazonais previstos por loja.

| Coluna       | Tipo     |
|--------------|----------|
| store_id     | int      |
| year_month   | timestamp|
| sales_monthly| double   |
| rank         | double   |
| year         | int      |
| month        | int      |
| month_name   | string   |

---

## Sazonalidade (referência)

### sales_br_seasonal_peaks
Média de vendas e ranking por mês/loja (padrão sazonal).

| Coluna     | Tipo   |
|------------|--------|
| store_id   | int    |
| month      | int    |
| avg_sales  | double |
| rank       | double |
| month_name | string |

---

## Cadastros

### stores_br
Lojas (parceiros / concessionárias).

| Coluna       | Tipo   |
|--------------|--------|
| store_id     | int    |
| store_name   | string |
| region       | string |
| city         | string |
| state        | string |
| size_m2      | double |
| opening_date | date   |
| manager      | string |

### products_br
Produtos (peças, etc.).

| Coluna            | Tipo    |
|-------------------|---------|
| product_id        | int     |
| product_name      | string  |
| category          | string  |
| price             | double  |
| cost              | double  |
| sku               | string  |
| reorder_point     | int     |
| launch_date       | timestamp|
| applicable_models | array&lt;string&gt; |

### stock_br
Estoque por produto e loja.

| Coluna        | Tipo  |
|---------------|-------|
| id_product    | int   |
| id_store      | int   |
| stock_quantity| bigint|

---

## Mapeamento para a tela “Previsão de quantidade de vendas por Produto”

A tabela da **Visão Pós-venda** pode ser alimentada por:

- **Parceiro / Loja:** `stores_br.store_name` (ou `store_id`), `stores_br.region` para “região”.
- **Categoria:** `products_br.category`.
- **Produto:** `products_br.product_name`.
- **Vendas (un.):** soma de `sales_br.quantity` por produto (e opcionalmente por loja/região), ou uso de `sales_br_by_store_monthly.sales_monthly` se a granularidade for por loja.
- **Previsão:** `sales_br_forecast_qty_by_region_monthly.vendas_previstas` (por região) ou `sales_br_forecast_qty_by_store_monthly.sales_forecast` (por loja). Para previsão por **produto** seria necessário uma view/agregação ou tabela adicional.
- **Risco de estoque:** comparação entre previsão (ou demanda) e `stock_br.stock_quantity` (e opcionalmente `products_br.reorder_point`).

Não existe hoje previsão por produto; as previsões são por **região** ou por **loja**. Para exibir “por produto” é preciso agregar vendas reais por produto (a partir de `sales_br`) e, se desejado, derivar ou criar uma previsão por produto (por exemplo via view ou job que distribua a previsão por loja/região para produto).
