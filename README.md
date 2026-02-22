# Databricks Dashboard & Genie

A single-page app with two menus: **Dashboard** (Databricks dashboard) and **Genie** (Databricks Genie), each shown in an iframe.

## Setup

1. **Dashboard**
   - In Databricks, open your published dashboard.
   - Click **Share** → **Embed dashboard**.
   - Copy the **iframe `src` URL** (e.g. `https://<workspace>.cloud.databricks.com/embed/dashboardsv3/<id>`).
   - In `index.html`, replace the `src` of the iframe with `id="iframe-dashboard"` with your URL.

2. **Genie / Pergunte sobre o Tera (iframe)**  
   - O Databricks **não** oferece uma URL de “Embed” só para o Genie. Use uma destas opções:
   - **Opção A (recomendada):** Se o seu Genie está vinculado a um **dashboard**, use a URL de embed do **dashboard**. No Databricks: abra o dashboard → **Share** → **Embed dashboard** → copie o `src` do iframe (formato `.../embed/dashboardsv3/<id>?o=...`). O botão “Ask Genie” aparece dentro do dashboard embarcado. No `index.html`, coloque essa URL no iframe com `id="iframe-genie"`.
   - **Opção B:** Para um Genie space standalone (room), use a URL direta do room: `https://<workspace>/genie/rooms/<space-id>?o=<workspace-id>`. Essa URL pode ser bloqueada em iframe (X-Frame-Options); se ficar em branco, use a Opção A.

3. **Chat Otto (Knowledge Assistant / Genie API)**  
   - O botão **"Fala, Otto!"** na Visão do Motorista usa o **Databricks Genie Conversation API** (Knowledge Assistant).  
   - **Onde configurar:** abra o arquivo **`js/databricks-genie.js`** e edite as variáveis no topo:
     - **`DATABRICKS_INSTANCE`**: URL do workspace (ex.: `https://fe-sandbox-xxx.cloud.databricks.com`), sem barra no final.
     - **`GENIE_SPACE_ID`**: ID do seu Genie Space (está na URL do space no Databricks).
     - **Autenticação** – escolha uma:
       - **Opção A (teste/demo):** preencha **`GENIE_TOKEN`** com um token (Settings → Developer → Access tokens). Não use em produção (token fica no frontend).
       - **Opção B (produção):** crie um backend que chama a API do Databricks com o token no servidor e exponha um endpoint; preencha **`PROXY_URL`** com a URL desse endpoint e deixe **`GENIE_TOKEN`** vazio.
   - Se nada for configurado, o chat mostra uma mensagem explicando como configurar.
   - **"Failed to fetch" / CORS:** chamar o Databricks direto do navegador costuma ser bloqueado por CORS. Use **PROXY_URL**: crie um backend que aceita `POST` com `{ "content": "pergunta" }`, chama o Knowledge Assistant (ou Genie) com o token no servidor e responde `{ "text": "resposta" }`. Em `databricks-genie.js` defina só **PROXY_URL** com a URL desse endpoint (ex.: `https://seu-backend.run.app/api/chat`).

4. **Allowed domains**
   - Your workspace admin must add this app’s origin (e.g. `http://localhost:8080` or your production domain) to the allowed embedding domains in **Manage dashboard and Genie access**.

## Como fazer o embed de uma sala Genie

O Databricks **não** gera um botão "Share → Embed" para uma sala Genie sozinha. Você pode embarcar o Genie de duas formas:

### Opção 1: Embed via dashboard (recomendado)

O Genie aparece como botão **"Ask Genie"** dentro de um dashboard embarcado.

1. No Databricks, abra o **dashboard** que tem o Genie que você quer (ou crie um dashboard e vincule o Genie: Settings do dashboard → **Link existing Genie space** → cole a URL da sala).
2. Clique em **Share** (canto superior direito) → **Embed dashboard**.
3. Copie o **`src`** do iframe (algo como `https://<workspace>.cloud.databricks.com/embed/dashboardsv3/<dashboard-id>?o=<workspace-id>`).
4. No seu app, use essa URL no iframe da seção "Pergunte sobre o Tera" (`index.html`, iframe com `id="iframe-genie"`).
5. Confirme que o domínio do seu app está em **Settings** → **Security** → **Embed dashboards** → domínios aprovados.

Assim a sala Genie fica acessível pelo "Ask Genie" dentro do dashboard embarcado.

### Opção 2: Embed direto da URL da sala (pode ser bloqueado)

A URL de uma sala Genie tem a forma:

```
https://<workspace>.cloud.databricks.com/genie/rooms/<space-id>?o=<workspace-id>
```

- **workspace:** parte do seu workspace (ex.: `fe-sandbox-leticia-demo-automobilistic-1`).
- **space-id:** ID da sala (ex.: `01f10ba1cf701a72be55d82980a77668`); está na barra de endereço quando você abre a sala no Databricks.
- **workspace-id (o=):** ID numérico do workspace (ex.: `7474651027276549`); aparece na URL do workspace.

**No seu app:** coloque essa URL no `src` do iframe (ex.: `id="iframe-genie"`).  
**Limitação:** muitas vezes o Databricks envia `X-Frame-Options` que impede carregar essa página dentro de um iframe em outro domínio. Se o iframe ficar em branco ou der erro, use a **Opção 1** (embed do dashboard).

### Resumo

| Objetivo              | O que fazer |
|-----------------------|-------------|
| Embed da sala Genie   | Use o **embed do dashboard** que tem essa sala vinculada (Share → Embed dashboard) e coloque essa URL no iframe. |
| Só tenho a URL da sala| Teste a URL da sala no iframe; se não carregar, crie/use um dashboard com o Genie vinculado e use o embed do dashboard. |

## Como fazer embed do Databricks One

**Databricks One** é a interface simplificada do Databricks para usuários de negócio (dashboards, Genie, apps). Ela fica em:

```
https://<workspace>.cloud.databricks.com/one
```

### Opção 1: Embed da página Databricks One inteira

Você pode tentar embarcar a interface completa em um iframe:

```html
<iframe
  src="https://<workspace>.cloud.databricks.com/one"
  title="Databricks One"
  width="100%"
  height="600"
  frameborder="0">
</iframe>
```

Substitua `<workspace>` pela URL do seu workspace (ex.: `fe-sandbox-leticia-demo-automobilistic-1`).  
**Limitação:** essa página pode ser bloqueada para iframe em outros domínios (X-Frame-Options). Se ficar em branco, use a Opção 2. O domínio do seu site precisa estar em **Settings** → **Security** → **Embed dashboards** → domínios aprovados.

### Opção 2: Embed dos componentes (recomendado)

Em vez da página `/one` inteira, embarca cada parte separadamente:

| Conteúdo        | Como embarcar |
|-----------------|----------------|
| **Dashboard**   | Share → Embed dashboard → use o `src` do iframe (`.../embed/dashboardsv3/<id>?o=...`). |
| **Genie**       | Use o embed do **dashboard** que tem o Genie (botão Ask Genie) ou a URL da sala; veja [Como fazer o embed de uma sala Genie](#como-fazer-o-embed-de-uma-sala-genie). |
| **Databricks App** | Use o iframe com a URL do app (veja abaixo). |

### Embed de um Databricks App

Para embarcar um **app** publicado no Databricks (por exemplo outro Databricks App):

```html
<iframe
  src="https://<app-url-do-app>"
  title="Nome do app"
  width="100%"
  height="600"
  frameborder="0">
</iframe>
```

- **Se o app está no workspace:** `https://<workspace>.cloud.databricks.com/apps/<nome-do-app>`  
- **Se o app está no Databricks Apps:** use a URL pública do app, ex.: `https://<app>-<id>.aws.databricksapps.com`

Requisitos: o app precisa estar publicado e acessível; quem visualiza precisa estar autenticado no Databricks (ou o app deve permitir acesso conforme sua configuração). O domínio da página que contém o iframe pode precisar estar na lista de domínios aprovados do workspace.

### Resumo

| Objetivo              | O que fazer |
|-----------------------|-------------|
| Embed da tela Databricks One inteira | Iframe com `https://<workspace>.cloud.databricks.com/one`. Pode ser bloqueado. |
| Embed de dashboard    | Share → Embed dashboard → URL `.../embed/dashboardsv3/<id>?o=...`. |
| Embed de um app       | Iframe com a URL do app (`/apps/<nome>` ou `*.databricksapps.com`). |

## Variáveis de ambiente no Databricks App

O chat Otto usa o backend (`/api/chat`), que precisa de **KA_ENDPOINT_URL** e **KA_TOKEN**. No Databricks Apps o `.env` não vai no deploy; defina as variáveis de uma destas formas:

### Opção A – Variáveis no `app.yaml` (rápido)

No arquivo **`app.yaml`**, na seção `env`, adicione:

```yaml
env:
  - name: PORT
    value: "8080"
  - name: KA_ENDPOINT_URL
    value: "https://SEU-WORKSPACE.cloud.databricks.com/serving-endpoints/SEU-KA/invocations"
  - name: KA_TOKEN
    value: "seu-token-databricks"
```

- **KA_ENDPOINT_URL:** no Databricks, vá em **Agents** → seu Knowledge Assistant → **See Agent status** e use a URL do endpoint (ex.: `.../serving-endpoints/NomeDoAgent/invocations`).
- **KA_TOKEN:** **Settings** → **Developer** → **Access tokens** → gerar ou copiar um token.

**Atenção:** não faça commit de tokens no repositório. Use a Opção B em repositórios compartilhados ou públicos.

### Opção B – Token em Secret (recomendado para produção)

1. **Criar o secret no workspace**
   - No Databricks: **Settings** → **Secrets** (ou **Workspace** → **Secret Scopes**).
   - Crie um scope (se não existir) e adicione um secret, por exemplo `ka-token` com o valor do token.

2. **Vincular o secret ao app**
   - Abra o app no Databricks → **Settings** (ou **Configure**).
   - Em **Resources** (ou **App resources**), clique em **+ Add resource**.
   - Escolha **Secret**, selecione o scope e o secret (ex.: `ka-token`).
   - Defina um **resource key**, por exemplo `ka_token` (é o nome que você usa no `app.yaml`).

3. **Referenciar no `app.yaml`**
   - Deixe a URL em texto e o token vindo do secret:

```yaml
env:
  - name: PORT
    value: "8080"
  - name: KA_ENDPOINT_URL
    value: "https://SEU-WORKSPACE.cloud.databricks.com/serving-endpoints/SEU-KA/invocations"
  - name: KA_TOKEN
    valueFrom: ka_token
```

   - `valueFrom: ka_token` deve ser igual ao **resource key** que você definiu ao adicionar o secret ao app.

4. **Permissões**
   - O service principal do app precisa de permissão de **leitura** no scope onde o secret está (ajuste em **Settings** do app ou nas permissões do scope).

Depois de alterar o `app.yaml` ou os resources, faça **redeploy** do app para as variáveis passarem a valer.

## Run locally

Open `index.html` in a browser, or serve the folder with any static server, for example:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the URL shown (e.g. `http://localhost:3000` or `http://localhost:8080`).
