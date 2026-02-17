# Databricks Dashboard & Genie

A single-page app with two menus: **Dashboard** (Databricks dashboard) and **Genie** (Databricks Genie), each shown in an iframe.

## Setup

1. **Dashboard**
   - In Databricks, open your published dashboard.
   - Click **Share** → **Embed dashboard**.
   - Copy the **iframe `src` URL** (e.g. `https://<workspace>.cloud.databricks.com/embed/dashboardsv3/<id>`).
   - In `index.html`, replace the `src` of the iframe with `id="iframe-dashboard"` with your URL.

2. **Genie**
   - Open your Genie space in Databricks.
   - Use **Share** → **Embed** if your workspace supports Genie embed (same idea as dashboards).
   - If you get an embed URL, put it in the iframe with `id="iframe-genie"`.
   - If Genie is only available via API, you can replace that panel with a custom UI that calls the [Genie Conversation API](https://docs.databricks.com/aws/en/genie/conversation-api).

3. **Allowed domains**
   - Your workspace admin must add this app’s origin (e.g. `http://localhost:8080` or your production domain) to the allowed embedding domains in **Manage dashboard and Genie access**.

## Run locally

Open `index.html` in a browser, or serve the folder with any static server, for example:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the URL shown (e.g. `http://localhost:3000` or `http://localhost:8080`).
