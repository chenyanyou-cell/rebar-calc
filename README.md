# 鋼筋籠撿料計算手機網頁版

這是一個靜態網頁工具，計算都在手機瀏覽器內完成，不需要 Python 伺服器。

## 員工使用方式

1. 用 iPhone Safari 開啟公司提供的網址。
2. 輸入案名、樁徑、鋼筋籠數量與籠長。
3. 依圖面輸入主筋與箍筋標示。
4. 點「計算」查看主筋、箍筋、約需料與總重量。

## 支援標示

- 主筋：`16-D16`、`D16x16`、`#5 16支`、`#516`
- 箍筋：`D10@20`、`#3@20cm`

## 部署方式

### 公司內部使用

把整個 `rebar-web` 資料夾放到公司內部網站、NAS 的 Web Station、IIS、Nginx 或 Apache。

### 雲端使用

可放到 GitHub Pages、Netlify、Cloudflare Pages 或其他靜態網站服務。

## GitHub Pages 部署

GitHub Pages 需要讓 `index.html` 在 repository 根目錄。

### 第一次建立

1. 到 GitHub 建立新 repository，例如 `rebar-calc`。
2. Repository 建議設為 Public，免費 GitHub Pages 最簡單。
3. 上傳本資料夾內所有檔案到 repository 根目錄：
   - `index.html`
   - `styles.css`
   - `app.js`
   - `.nojekyll`
   - `README.md`
4. 到 repository 的 `Settings`。
5. 點左側 `Pages`。
6. Source 選 `Deploy from a branch`。
7. Branch 選 `main`，資料夾選 `/root`。
8. 儲存後等 1-3 分鐘。
9. 網址通常會是：

```text
https://你的GitHub帳號.github.io/rebar-calc/
```

### 更新版本

以後要更新，只要覆蓋上傳 `index.html`、`styles.css`、`app.js`，GitHub Pages 會自動重新發布。

### 本機測試

在 `outputs` 資料夾啟動靜態伺服器，然後開啟：

```text
http://電腦IP:8765/rebar-web/
```

若只是同一台電腦測試：

```text
http://127.0.0.1:8765/rebar-web/
```
