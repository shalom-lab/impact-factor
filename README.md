## Impact Factor 数据展示平台

一个零后端、基于 GitHub Pages 自动部署的 CSV 数据浏览器，专为展示影响因子、期刊分区、出版指标等任意学术评价数据集而设计。

### 功能亮点

- 自动扫描仓库 `data/` 目录中的全部 CSV 文件
- 左侧文件列表 + 右侧智能表格（搜索、排序、分页）
- 仅依赖前端 React + TanStack Table + PapaParse，实现纯前端渲染
- `npm run manifest` 自动生成 `public/data-manifest.json`
- GitHub Actions 自动构建并部署至 GitHub Pages

### 使用方式

1. **安装依赖**
   ```bash
   npm install
   ```
2. **本地开发**
   ```bash
   npm run dev
   ```
   该命令会同步生成最新 manifest 并启动 Vite Dev Server。
3. **构建产物**
   ```bash
   npm run build
   ```
   在 `dist/` 目录下生成可部署页面。

### 添加 / 更新 CSV

1. 将新的 CSV 文件直接放入仓库的 `data/` 目录。
2. 运行 `npm run manifest`（或任何一次 `dev`／`build`）即可刷新文件清单。
3. 将改动推送到 `main` 分支，GitHub Actions 会自动重新构建并发布。

> **注意**：CSV 必须包含表头行；UTF-8 编码可获得最佳兼容性。

### GitHub Pages 部署

仓库已包含 `.github/workflows/deploy.yml`，默认会在推送到 `main` 时：

1. 安装依赖并执行 `npm run build`
2. 通过 `peaceiris/actions-gh-pages` 将 `dist` 发布到 `gh-pages` 分支
3. 自动更新 GitHub Pages 站点

### 自定义

- 如需调整 GitHub Pages 路径，可在构建时设置 `VITE_BASE_PATH` 环境变量
- 表格组件基于 TanStack Table，可按需拓展筛选、导出等高级功能
- 所有样式集中在 `src/App.css`，可根据品牌风格快速重绘 UI

