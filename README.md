# Databricks Dashboard & Genie

A single-page app with two menus: **Dashboard** (Databricks dashboard) and **Genie** (Databricks Genie), each shown in an iframe.

## Setup

1. **Dashboard**
   - In Databricks, open your published dashboard.
   - Click **Share** → **Embed dashboard**.
   - Copy the **iframe `src` URL** (e.g. `https://<workspace>.cloud.databricks.com/embed/dashboardsv3/<id>`).
   - In `index.html`, replace the `src` of the iframe with `id="iframe-dashboard"` with your URL.

2. **Genie (iframe)**  
   - Open your Genie space in Databricks and use **Share** → **Embed** if available; put the URL in the iframe with `id="iframe-genie"`.

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
