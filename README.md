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


### 数据流

- **读取**：从仓库 `{dataPath}/` 目录加载 CSV / XLSX，使用 Handsontable 渲染
- **多工作表**：XLSX 多 sheet 时右侧 Tab 切换，每个 sheet 独立 Handsontable 实例
- **上传 / 删除**：推送或远程删除仓库文件
- **限制**：单文件最大 30MB，单表最多 100,000 行，单文件最多 50 个工作表

```bash
npm install
npm run dev
```
