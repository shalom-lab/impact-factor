## SheetView

基于 GitHub 的表格数据浏览工具，支持 CSV / XLSX 上传与在线查看。

### localStorage

| 键名 | 说明 |
|------|------|
| `gh-sheetview-token` | GitHub Token |
| `gh-sheetview-repo` | 仓库 `owner/repo` |
| `gh-sheetview-data-path` | 数据目录，默认 `data` |

```javascript
localStorage.setItem('gh-sheetview-token', 'github_pat_xxxx');
localStorage.setItem('gh-sheetview-repo', 'shalom-lab/impact-factor');
localStorage.setItem('gh-sheetview-data-path', 'data');
location.reload();
```

`canRead` / `canWrite` / `defaultBranch` 不存储，启动时 API 自动验证。

### 数据流

- **读取**：从仓库 `{dataPath}/` 目录加载 CSV / XLSX
- **上传**：直接推送明文文件到 GitHub 同目录
- **限制**：单文件最大 10MB，单表最多 100,000 行

```bash
npm install
npm run dev
```
