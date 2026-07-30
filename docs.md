l# AI Agent 多模式桌面应用开发文档

**版本**：1.0  
**应用名称**：Void AI Assistant  
**核心技术**：Electron + React + TypeScript  
**设计理念**：通用大模型接口，用户完全自主，极简黑色主题  
**最后更新**：2026-07-30

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心需求与约束](#2-核心需求与约束)
3. [系统架构](#3-系统架构)
4. [技术栈](#4-技术栈)
5. [目录结构](#5-目录结构)
6. [通用 API 适配层](#6-通用-api-适配层)
7. [API 配置与用量管理](#7-api-配置与用量管理)
8. [学习模式](#8-学习模式)
9. [规划模式](#9-规划模式)
10. [专注模式](#10-专注模式)
11. [日记模式](#11-日记模式)
12. [UI 设计系统与主题](#12-ui-设计系统与主题)
13. [数据存储与安全](#13-数据存储与安全)
14. [IPC 接口定义](#14-ipc-接口定义)
15. [模块交互细节](#15-模块交互细节)
16. [附录：关键数据结构与默认配置](#16-附录关键数据结构与默认配置)

---

## 1. 项目概述

**Void AI Assistant** 是一款运行于本地的桌面 AI 代理工具，完全由用户自行配置大语言模型（LLM）接口。它不绑定任何特定模型厂商，也不内置任何 API Key 或代理服务。用户可根据需要接入 OpenAI、Anthropic、本地部署的 Ollama、LM Studio 等任何兼容 OpenAI API 格式的服务。

应用围绕四个核心使用场景设计：

- **学习模式** – 模块化知识管理，代码风格学习，笔记智能交互。
- **规划模式** – 长期/短期/每日计划管理，AI 辅助拆解与评估。
- **专注模式** – 极简计时与倒计时，自我评分，AI 情感反馈。
- **日记模式** – 每日记录，自然对话，回忆查询。

所有 AI 能力均来自用户配置的后端模型，应用本身只是一个高效、安全、美观的交互界面与本地数据管理工具。

---

## 2. 核心需求与约束

- **用户完全控制 API**：应用不内置任何 API Key 或代理端点，用户必须自行添加至少一个 API 配置才能使用 AI 功能。
- **多 API 支持**：允许同时配置多个 API 后端（例如一个云端模型用于复杂任务，一个本地模型用于快速响应），并可在不同模式或会话中切换。
- **OpenAI 兼容接口**：要求用户提供的 API 必须兼容 `/v1/chat/completions` 端点格式（包括流式响应 `stream: true`）。大多数主流 LLM 服务均满足此要求。
- **用量透明**：界面实时展示当前会话、当日及当月的 Token 消耗与预估费用。费用由用户根据模型官方定价自行设置单价。
- **本地优先**：所有用户数据（笔记、日记、计划、对话记录）仅存储于本地文件系统，不上传至任何云端。
- **文件操作授权**：AI 可通过 Function Calling 读取用户指定的本地文件，但任何写入或编辑操作必须经过用户显式确认。
- **可扩展学习模块**：用户可自由创建、删除自定义学习模块，每个模块独立管理笔记文件与对话上下文。
- **黑色简约主题**：全局采用深色模式，无干扰设计，专注内容与交互。

---

## 3. 系统架构

```
┌──────────────────────────────────────────────────────┐
│                   Electron Application               │
│                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │    渲染进程 (React)   │  │    主进程 (Node.js)   │ │
│  │                      │  │                      │ │
│  │  - 黑色主题 UI       │  │  - 加密存储 API Key  │ │
│  │  - 四种模式路由      │  │  - LLM 请求封装       │ │
│  │  - 对话、计时器等    │  │  - 文件系统操作       │ │
│  │                      │  │  - 用量统计与计费    │ │
│  └──────────┬───────────┘  └──────────┬───────────┘ │
│             │                         │             │
│             └─────── IPC 通信 ─────────┘             │
└──────────────────────────────────────────────────────┘
```

- **渲染进程**：纯 UI 层，负责展示与用户交互，不直接调用 Node.js API 或访问文件系统。
- **主进程**：拥有系统权限，负责所有需要安全控制的操作，通过 `contextBridge` 暴露有限的、经过包装的 API 给渲染进程。
- **LLM 适配层**：主进程中维护一个统一的 LLM 调用器，根据当前选择的 API 配置动态构建请求，处理流式响应，并统一记录 Token 用量。

---

## 4. 技术栈

| 分类     | 技术                                        |
| -------- | ------------------------------------------- |
| 桌面框架 | Electron 28+                                |
| 前端     | React 18 + TypeScript                       |
| 状态管理 | Zustand                                     |
| 样式方案 | Tailwind CSS（自定义暗色主题）              |
| 网络请求 | `fetch` / `node-fetch`（保持轻量）          |
| 数据存储 | better-sqlite3（结构化数据）+ Markdown 文件 |
| 安全     | Electron `safeStorage`                      |
| 打包     | electron-builder                            |

---

## 5. 目录结构

```
void-ai-assistant/
├── package.json
├── tailwind.config.js
├── src/
│   ├── main/
│   │   ├── index.ts                 # Electron 主入口
│   │   ├── ipc-handlers.ts          # 所有 IPC 通信处理
│   │   ├── llm/
│   │   │   ├── adapter.ts           # 通用 LLM 请求封装（流式）
│   │   │   ├── function-calling.ts  # 工具调用解析与执行
│   │   │   └── context-manager.ts   # 对话历史与系统提示管理
│   │   ├── storage/
│   │   │   ├── database.ts          # SQLite 初始化与查询封装
│   │   │   ├── file-manager.ts      # 文件读取、写入、diff
│   │   │   └── key-store.ts         # API Key 加密存储
│   │   ├── usage/
│   │   │   └── monitor.ts           # Token 记录、费用计算、限额检查
│   │   └── tools/                   # 工具定义与处理
│   │       ├── definitions.ts       # Function Calling 工具列表
│   │       └── handlers.ts          # 工具执行函数（文件读写等）
│   ├── preload/
│   │   └── index.ts                 # contextBridge 安全暴露 API
│   ├── renderer/
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── common/              # 通用组件（按钮、卡片、模态框）
│   │   │   ├── chat/                # 对话面板、消息气泡
│   │   │   ├── settings/            # API 配置表单、用量图表
│   │   │   └── layout/              # 侧边栏、模式导航、状态栏
│   │   ├── modes/
│   │   │   ├── Learning/
│   │   │   ├── Planning/
│   │   │   ├── Focus/
│   │   │   └── Diary/
│   │   ├── store/                   # Zustand stores
│   │   └── styles/
│   │       └── theme.css            # 黑色主题定制
│   └── shared/
│       └── types.ts                 # 通用类型定义
└── resources/                       # 图标与字体
```

---

## 6. 通用 API 适配层

### 6.1 设计原则

应用必须与具体模型解耦，仅依赖 OpenAI Chat Completions API 格式。所有 LLM 交互通过统一的 `LlmAdapter` 完成，该适配器：

- 接收用户配置的 `ApiConfig` 对象。
- 支持 `stream: true` 的流式响应。
- 自动添加系统提示、历史消息、工具定义。
- 返回标准化的事件流（chunk）供前端渲染。
- 从响应中提取 `usage` 信息，转交用量监控器。

### 6.2 API 配置模型

```typescript
interface ApiConfig {
  id: string;
  name: string;               // 用户自定义名称，如 "我的 Claude"
  baseUrl: string;            // https://api.openai.com/v1
  apiKey: string;             // 加密存储，仅在调用时解密
  model: string;              // 模型标识，如 gpt-4o, claude-sonnet-4-20250514
  temperature?: number;
  maxTokens?: number;
  pricing?: {
    inputPrice: number;       // 每1000 tokens 价格（美元）
    outputPrice: number;
  };
  headers?: Record<string, string>; // 额外请求头
  isActive: boolean;          // 是否当前选用的配置
}
```

### 6.3 流式请求核心流程

```
用户消息 → IPC → 主进程获取激活的ApiConfig → 
构建请求体（messages, system, tools, stream:true） →
fetch(baseUrl + '/chat/completions', ...) →
逐块读取响应流 → 每块通过IPC推送至前端 →
响应完成 → 提取usage → 记录用量
```

关键代码示意（主进程 `adapter.ts`）：

```typescript
export async function* streamChat(
  config: ApiConfig,
  body: { system: string; messages: any[]; tools?: any[] }
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      ...config.headers,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: body.system },
        ...body.messages,
      ],
      tools: body.tools,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096,
      stream: true,
    }),
  });

  const reader = response.body?.getReader();
  // 逐行解析 SSE，yield delta 内容...
  // 最后 yield 结束事件，带 usage 信息（如有）
}
```

### 6.4 工具调用（Function Calling）支持

应用定义的标准工具集（如读文件、提议编辑）将与消息一同发送。不同模型对工具调用的支持程度不同，应用会检测当前模型是否支持 `tools` 字段（可通过尝试验证），若不支持则自动降级为纯文本交互（仅在对话中提示用户手动操作文件）。

---

## 7. API 配置与用量管理

### 7.1 配置管理界面

设置页面提供 API 配置列表，支持：

- 添加新配置（填写 Base URL、API Key、模型名称、可选定价）。
- 编辑已有配置。
- 删除配置。
- 激活某个配置（设置 `isActive = true`，同时将其他配置设为 false）。
- 测试连接：发送一条极短消息验证端点可用性。

所有 API Key 使用 Electron 的 `safeStorage` 加密存储，仅在内存中短时解密。

### 7.2 用量记录与展示

每次 API 调用结束后，从响应中提取 `usage` 对象（标准字段：`prompt_tokens`, `completion_tokens`, `total_tokens`）。若模型返回格式不同，适配器需统一转换为内部 `UsageData` 类型：

```typescript
interface UsageData {
  timestamp: number;
  configId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}
```

数据存储至 SQLite 表 `api_usage`。

**用量指示器**（侧边栏底部或状态栏）实时显示：

- 当前会话 Token 总计
- 今日 Token 消耗及预估费用（`input * inputPrice + output * outputPrice`）
- 本月累计

用户可在设置中：

- 查看按日/月聚合的用量图表（使用简单的柱状图或列表）。
- 设置月度预算上限（Token 数量或金额），超过时应用将阻止自动发送，并提示用户。

---

## 8. 学习模式

### 8.1 模块概念

学习模式是容器，用户可创建多个**学习模块**。每个模块代表一个独立的学科或项目，拥有：

- 独立的对话会话
- 一组关联的本地笔记文件（`.md`）
- 专有的系统提示（可选）

默认内置一个 **C++** 模块，不支持删除，以示代码风格学习能力。

### 8.2 模块数据结构

```typescript
interface LearningModule {
  id: string;
  name: string;
  noteFiles: string[];               // 允许访问的 markdown 文件绝对路径
  codeStyleSummary: string | null;   // 仅 C++ 模块有效，风格摘要
  conversationId: string;            // 关联的会话ID
  createdAt: number;
}
```

### 8.3 代码风格学习（C++ 模块专属）

C++ 模块额外提供“代码风格学习”功能，其核心是在系统提示中持续注入用户的风格偏好摘要。

**学习流程：**

1. 用户在聊天框发送一段 C++ 代码。
2. 前端将消息标记为“代码消息”，附带原始代码。
3. 主进程在调用 LLM 前，将当前存储的 `codeStyleSummary` 注入系统提示：“You are a C++ expert. The user's coding style is: {summary}. Follow this style in your code suggestions.”
4. LLM 生成回复后，后台使用一个**轻量级请求**（或复用主模型，取决于用户配置）分析刚才发送的代码，提取风格特征（缩进风格、命名规范、注释习惯、大括号位置等），生成一小段描述性文本。
5. 将新生成的描述与现有摘要融合（简单合并或让模型总结），更新 `codeStyleSummary`。

随着用户不断提交代码，AI 提供的代码建议将越来越接近用户个人风格。

### 8.4 笔记功能

**绑定文件：**
用户通过“关联笔记”按钮选择本地 `.md` 文件，路径存入模块的 `noteFiles`。支持绑定多个文件。

**AI 读取：**
AI 对话中可通过 Function Calling 调用 `read_file` 工具，指定文件名。主进程验证该路径是否属于当前模块的 `noteFiles`，若是则返回完整内容。

**AI 编辑：**
1. AI 调用 `propose_edit` 工具，参数为文件路径和修改后的全文。
2. 主进程计算与现版本的差异，生成 diff 数据。
3. 渲染进程弹出差异对比视图，左右分别显示原稿与新稿。
4. 用户点击“应用修改”后，主进程执行文件写入，并自动创建 `.bak` 备份。
5. 若用户在外部修改了文件，导致 hash 不一致，则提示冲突并要求手动处理。

**安全：**
任何文件写入前均进行路径校验，且该操作不会绕过用户确认。

---

## 9. 规划模式

### 9.1 计划模型

```typescript
interface Plan {
  id: string;
  type: 'long-term' | 'short-term' | 'today';
  title: string;
  items: PlanItem[];
  createdAt: number;
  updatedAt: number;
}

interface PlanItem {
  id: string;
  content: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  deadline?: number;          // 时间戳
  aiNote?: string;            // AI 附加建议
}
```

### 9.2 交互功能

- 在规划模式侧边对话中，用户可要求 AI：
  - “帮我评估这个长期计划是否可行，并提出修改建议。”
  - “把短期计划拆解成每日任务。”
  - “根据今天完成情况调整明天安排。”
- AI 通过 Function Calling 获取当前计划数据，分析后调用 `update_plan` 工具提交修改草案。
- 所有修改在用户预览确认后生效。

### 9.3 显示层

规划模式主界面包含：

- 左侧：计划列表树（长期/短期/今日），可切换查看。
- 右侧：选中计划的详情面板，以清单或卡片形式展示事项，支持勾选完成、修改优先级。
- 底部：可折叠的 AI 助手对话区。

---

## 10. 专注模式

### 10.1 界面流转

```
[ 极简时钟 ] ← 默认进入
      │
      ▼
[ 设定目的与时长 ]
      │
      ├── 正计时 → [ 运行中 (大数字计时) ]
      └── 倒计时 → [ 运行中 (倒计时数字) ]
      │
      ▼
[ 手动结束 或 时间到 ]
      │
      ▼
[ 自评分数 ] → [ AI 简短反馈 ] → 返回时钟
```

### 10.2 数据记录

每次专注任务完成后，记录：

```typescript
interface FocusSession {
  id: string;
  purpose: string;            // 用户输入的目的
  duration: number;           // 实际专注秒数
  targetDuration: number;     // 计划时长（倒计时用，正计时可为0）
  type: 'count-up' | 'count-down';
  rating: number;             // 1-5
  note: string;               // 可选备注
  timestamp: number;
}
```

### 10.3 AI 反馈机制

**每次任务结束后：**
将最近 7 条会话记录及本次评分传递给 LLM，生成一段富有同理心的反馈文字，展现于评分界面之后。语气根据历史数据调整，如鼓励、轻松幽默、严肃提醒等。

**主动建议（可选通知）：**
以下条件触发非侵入式桌面通知（用户可关闭）：

- 连续 3 天无任何专注记录。
- 近一周娱乐类目的总时长超过学习类目 2 倍（通过目的关键词简单分类）。
- 累计专注达到里程碑（如10小时、50小时）。

---

## 11. 日记模式

### 11.1 自动日记

每天首次进入日记模式时，应用自动检查是否存在 `diaries/YYYY-MM-DD.md`，若不存在则创建新文件，并插入当前时间戳和一句问候语。

### 11.2 对话式交互

日记模式提供一个纯净的聊天窗口，AI 被赋予日记伙伴角色。用户可：

- 口述今天的经历，AI 整理并追加到今日日记中。
- 提问“我上周五做了什么？” – AI 可通过 `read_file` 读取指定日期文件并回答。
- 获得情绪支持或日常陪伴。

### 11.3 隐私保护

所有日记文件保存在本地应用数据目录，不参与任何形式的自动同步。用户可手动导出或删除。

---

## 12. UI 设计系统与主题

### 12.1 设计语言

- **整体氛围**：深邃、静谧、无干扰，黑色背景主导，高对比度文字。
- **色彩方案**：
  - 主背景：`#0A0A0A`（深黑）
  - 次级背景（卡片/面板）：`#141414`
  - 边框/分割线：`#2A2A2A`
  - 文字主色：`#E5E5E5`
  - 文字次要：`#A3A3A3`
  - 强调色：`#3B82F6`（冷蓝，用于按钮、链接、选中状态）
  - 成功绿：`#22C55E`
  - 警示橙：`#F59E0B`
  - 错误红：`#EF4444`
- **字体**：系统等宽无衬线优先（`Inter` 或系统默认），代码块使用 `JetBrains Mono`。
- **圆角**：极小（`4px`），保持锐利现代感。
- **阴影**：微弱的扩散阴影，或不使用。

### 12.2 布局结构

应用窗口分为：

- **侧边栏**（固定宽度 64px）：模式图标导航（学习/规划/专注/日记），底部设置按钮和用量指示器。
- **主内容区**：当前模式视图。
- **顶栏**（可选）：显示当前模式标题、API 状态指示灯、全局搜索。

所有界面元素遵循极简原则，减少视觉噪音。

### 12.3 组件规范（Tailwind 自定义主题）

在 `tailwind.config.js` 扩展颜色、字体，并开启 `darkMode: 'class'`（始终强制暗色）。自定义组件如按钮、输入框、卡片均封装为 React 组件，保持一致性。

---

## 13. 数据存储与安全

### 13.1 数据库设计（SQLite）

- `api_configs`：存储 API 配置（`apiKey` 字段存加密后的字符串，主进程动态解密）。
- `api_usage`：每次调用的 Token 记录。
- `conversations`：对话元数据（关联模式、模块ID、标题等）。
- `messages`：具体消息内容（支持 text 和 tool_call 类型）。
- `learning_modules`：学习模块定义。
- `plans`：计划数据（JSON 文本存储 items）。
- `focus_sessions`：专注记录。
- `settings`：键值对存储用户偏好（主题、通知等）。

### 13.2 文件存储

- 笔记文件：用户显式选择的路径，应用仅记录路径，不复制文件。
- 日记文件：`{userData}/diaries/` 下。
- 所有写操作都经过用户确认，生成备份。

### 13.3 安全措施

- **API Key 加密**：使用 Electron `safeStorage.encryptString()`，OS 密钥环保护。
- **上下文隔离**：`contextIsolation: true`, `nodeIntegration: false`。
- **网络限制**：仅允许向用户配置的 `baseUrl` 发起请求，防止数据泄露。
- **依赖审核**：保持最小依赖，定期检查漏洞。

---

## 14. IPC 接口定义

以下为渲染进程可调用的主要方法（通过 `window.electronAPI`）：

| 方法                         | 参数                                | 返回                      | 说明                               |
| ---------------------------- | ----------------------------------- | ------------------------- | ---------------------------------- |
| `getConfigs()`               | -                                   | `ApiConfig[]`             | 获取所有 API 配置（不含明文 key）  |
| `saveConfig(config)`         | `ApiConfig`                         | `void`                    | 保存或更新配置                     |
| `deleteConfig(id)`           | `string`                            | `void`                    | 删除配置                           |
| `testConnection(configId)`   | `string`                            | `{ok, error?}`            | 发送空测试请求                     |
| `sendMessage(params)`        | `{mode, moduleId?, message}`        | `string (conversationId)` | 开始对话流，返回会话ID             |
| `onStreamChunk`              | 回调 `(chunk: StreamChunk) => void` | -                         | 监听流式数据（文本/工具调用/结束） |
| `removeStreamListener()`     | -                                   | -                         | 移除监听                           |
| `getUsageSummary()`          | -                                   | `UsageSummary`            | 获取今日/月用量                    |
| `readFile(path)`             | `string`                            | `string`                  | 读取模块绑定文件                   |
| `proposeEdit(path, content)` | `{path, content}`                   | `{editId, diff}`          | 生成差异供预览                     |
| `confirmEdit(editId)`        | `string`                            | `void`                    | 应用编辑                           |
| `getPlans()`                 | -                                   | `Plan[]`                  | 获取所有计划                       |
| `savePlan(plan)`             | `Plan`                              | `void`                    | 创建或更新计划                     |
| `logFocusSession(session)`   | `FocusSession`                      | `void`                    | 保存专注记录                       |
| ...                          | ...                                 | ...                       | ...                                |

---

## 15. 模块交互细节

- **模式切换时保留状态**：各个模式的 Zustand store 独立，切换时不清除对话或计划，除非用户主动重置。
- **全局快捷键**：`Ctrl+1/2/3/4` 快速切换模式；专注模式运行时可通过 `Esc` 退出。
- **多窗口（可选）**：未来可支持将日记或专注模式弹出为独立窗口，但首版仅限单窗口。

---

## 16. 附录：关键数据结构与默认配置

### 16.1 默认系统提示词（各模式）

- **学习模式（通用）**：“You are an AI study companion. Help the user understand notes, summarize key concepts, and propose edits to their markdown files only when asked. Use tools to read or suggest changes. Never edit files without explicit user confirmation.”
- **C++ 模块额外注入**：“You are a C++ expert. The user’s coding style summary: {style}. Mimic this style in any code you provide.”
- **规划模式**：“You are a strategic planner. Help the user evaluate their plans, break down long-term goals, and suggest adjustments. You have access to their current plan data. Always present modifications for review before applying.”
- **专注反馈**：“You are a supportive coach. The user has just completed a focus session: {session}. Recent history: {recent}. Provide a brief, empathetic response that encourages or advises based on their pattern.”
- **日记模式**：“You are a reflective diary companion. Engage in natural conversation, help summarize daily entries, and recall past events when asked. Be warm and understanding.”

### 16.2 默认工具定义（Function Calling）

```json
[
  {
    "type": "function",
    "function": {
      "name": "read_file",
      "description": "Read the content of a note file bound to the current learning module.",
      "parameters": {
        "type": "object",
        "properties": {
          "filePath": {"type": "string"}
        },
        "required": ["filePath"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "propose_edit",
      "description": "Suggest a new full content for a note file. The edit will NOT be applied until user confirms.",
      "parameters": {
        "type": "object",
        "properties": {
          "filePath": {"type": "string"},
          "newContent": {"type": "string"}
        },
        "required": ["filePath", "newContent"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_plans",
      "description": "Retrieve all current user plans and items.",
      "parameters": {}
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_plan",
      "description": "Propose an updated plan structure. Changes need user confirmation.",
      "parameters": {
        "type": "object",
        "properties": {
          "planId": {"type": "string"},
          "updatedPlan": {"type": "object"}
        },
        "required": ["planId", "updatedPlan"]
      }
    }
  }
]
```

### 16.3 黑色主题 Tailwind 配置片段

```javascript
// tailwind.config.js 扩展
module.exports = {
  darkMode: 'class', // 始终应用
  theme: {
    extend: {
      colors: {
        void: {
          bg: '#0A0A0A',
          surface: '#141414',
          border: '#2A2A2A',
          text: '#E5E5E5',
          secondary: '#A3A3A3',
          accent: '#3B82F6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

---

此文档描述了 **Void AI Assistant** 的完整功能定义、架构设计、API 适配方案、UI 规范以及数据安全策略。开发实现时可严格参照本文档进行，以保证产品最终与设计意图一致。