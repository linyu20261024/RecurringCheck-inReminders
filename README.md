# 周期任务与收益提醒助手 (Periodic Task & Yield Assistant)

高效周期任务提醒管理、App 聚合批量打卡、算式速算及纯人民币现金收益多维可视化报表系统。

## ✨ 核心特性

- 📱 **按 App 聚合批量打卡**：自动将当天所有任务按平台（如支付宝、微信、建行生活、兴业生活等）分组，打开一个 App 一次性完成，支持「该 App 一键全打卡」与内部路径指引（一键复制）。
- 🧮 **原生算式速算**：打卡实收金额支持键入公式（如 `0.8*2`、`3+5`），系统自动求值并入账。
- 💰 **纯人民币收益分析**：现金收益严格统计人民币（¥），彻底剔除虚拟积分干扰；支持按月份、按平台及关键词多维检索与走势分析。
- 📊 **透明完成率指标**：明确区分「截至今日已达完成率」与「全期总排期推进率」，直观展示已执行、待执行与总排期数据。
- ⚙️ **起止有效日期与级联清理**：规则支持配置生效起止范围，删除规则时自动级联清理未来未完成的待办任务，妥善保留历史真实收益数据。
- 🔒 **100% 本地隐私安全**：默认初次打开为空白，无任何内置假数据或第三方服务端依赖，所有规则与打卡数据均存储于浏览器本地 `localStorage`，支持一键 JSON 导入与导出备份。

---

## 🚀 本地开发与运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```
启动后在浏览器访问 `http://localhost:3000` 即可。

### 3. 构建生产包
```bash
npm run build
```
编译产物将生成在 `dist` 目录下。

---

## 🌐 部署至 GitHub Pages 静态网页

本项目已预先配置 `base: './'` 相对路径，原生支持静态网页托管：

1. 在 GitHub 仓库设置中，进入 **Settings -> Pages**。
2. 在 **Build and deployment** 下的 **Source** 选择 **GitHub Actions**。
3. 或者直接运行 `npm run build`，将生成的 `dist` 目录推送到 `gh-pages` 分支即可完成上线。

---

## 📁 项目目录结构说明

```text
├── index.html                  # HTML 入口
├── vite.config.ts              # Vite 构建配置（已配置 base: './' 兼容 GitHub Pages）
├── tsconfig.json               # TypeScript 配置文件
├── package.json                # 项目依赖清单
├── src/
│   ├── main.tsx                # 应用启动入口
│   ├── App.tsx                 # 主页面骨架与状态流转
│   ├── index.css               # 全局样式（Tailwind CSS v4）
│   ├── types.ts                # TypeScript 领域数据类型定义
│   ├── services/
│   │   └── dataStorage.ts      # 本地持久化、JSON导入导出、算式求值与级联清理服务
│   └── components/
│       ├── Navbar.tsx          # 顶部导航栏
│       ├── TaskRemindersView.tsx # 今日任务提醒与 App 聚合办理工作台
│       ├── AnalyticsView.tsx   # 现金收益统计大屏（按月/按平台检索）
│       ├── RuleManagerView.tsx # 周期规则管理（含起止日期与级联删除）
│       ├── QuickCheckInModal.tsx # 快捷打卡与算式求值弹窗
│       ├── DataImportExportModal.tsx # 数据导入/导出管理弹窗
│       └── TemplateOptimizationModal.tsx # 模版优化诊断弹窗
└── public/                     # 静态资源目录
```
