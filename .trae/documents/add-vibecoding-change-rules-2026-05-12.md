# 计划：将“改动不乱（VibeCoding）”写入项目规则

## Summary

将“改动时避免把代码改乱”的 VibeCoding 变更方法，固化到项目级开发规范中（仅文档规则，适用于所有改动），落在 [AGENTS.md](file:///Users/aiden/Projects/morena/AGENTS.md) 新增章节，作为全团队/全 AI 协作的默认变更流程与自检清单。

## Current State Analysis

- 当前项目规则集中在 [AGENTS.md](file:///Users/aiden/Projects/morena/AGENTS.md)，覆盖包管理器、资源、提交规范、组件库、样式、网络请求、跨端等，但缺少“变更管理/改动流程/自检清单”。
- 项目已提供统一校验入口 `pnpm validate`（lint + tsc），但未在规则中明确要求“改动前/改动中/改动后”的触发时机与最小步长。
- 现状容易出现：一次性改动过大、跨文件误改、顺手重排/重写导致 diff 噪音大、问题定位困难。

## Proposed Changes

### 1) 更新 AGENTS.md：新增“变更管理（VibeCoding）”章节

**目标**

- 用可执行的步骤，把“改动不乱”从口头经验变成统一规范。
- 让任何改动都具备：范围可控、随时可回滚、可验证（以 `pnpm validate` 为最低标准）。

**落点与位置**

- 文件：[AGENTS.md](file:///Users/aiden/Projects/morena/AGENTS.md)
- 插入位置建议：在 `## Git 提交规范` 之后、`## 命名规范` 之前新增一节：
  - `## 变更管理（VibeCoding）`

**章节内容（写入规则的具体条目）**

- **六条硬规则**
  - 单次改动只解决一个问题（一个 bug / 一个小功能 / 一个重构点），禁止把多目标揉成一次提交。
  - 先写清“允许改动范围/禁止改动范围”，范围默认限制为 1–3 个文件；超出必须拆分。
  - 默认采用“手术式修改”：能局部 patch 就不整段重写；能追加就不大搬家；禁止无关格式化/重排。
  - 改动过程中必须分步校验：每完成一个小步骤至少跑一次 `pnpm validate`（或等价的 lint+tsc）。
  - 改动随时可回滚：本地至少保持一个可回退 checkpoint（例如小步提交或小步 stash），避免长时间堆积未验证改动。
  - 保持既有风格：不引入新依赖、不切换写法、不改命名风格；除非本次任务目标就是“统一风格/重构”。

- **标准变更模板（每次改动开始前必须写 4 行）**
  - Premise：现状是什么？目标是什么？（2 句话）
  - Constraints：禁止做什么？质量红线是什么？（例如 `pnpm validate` 必须通过）
  - Boundaries：只允许改哪些文件/函数？（列出文件路径）
  - Endgame：如何验收？（可验证标准：页面路径、操作步骤、数据结构、截图等）

- **AI 协作约束（适用于任何 AI 参与的改动）**
  - 先输出改动计划（修改点列表 + 为什么），确认后再输出具体修改。
  - 明确“禁止事项”：不要改动无关文件、不要重排 import、不要批量替换写法、不要重命名导出。
  - 明确“允许事项”：只对指定函数/片段做最小 diff。

- **改动后自检清单（diff 噪音拦截）**
  - 是否出现大面积空格/换行/排序变化但逻辑未变？
  - 是否出现 import 大重排但功能无关？
  - 是否误改公共类型/公共函数签名/接口字段名？
  - 是否新增了与目标无关的“顺手重构”？
  - `pnpm validate` 是否通过？

### 2) 校验与交付方式（仅文档）

- 交付物：更新后的 [AGENTS.md](file:///Users/aiden/Projects/morena/AGENTS.md)。
- 校验：
  - 文档结构正常（标题层级不破坏现有目录结构）。
  - 规则条目可直接复制执行（包含模板与检查清单）。
  - 运行 `pnpm validate`（可选，但建议做一次，确保仓库当前状态是“绿的”，便于以后用作基线）。

## Assumptions & Decisions

- 将规则落地为“仅文档约束”，不增加 Git Hook/PR 模板等强制机制（按用户选择）。
- 规则适用于所有改动（功能/修复/重构），用于控制变更范围与验证节奏。
- “最低质量门槛”统一以 `pnpm validate` 表达（仓库已有脚本）。

## Execution Steps

1. 打开并定位 [AGENTS.md](file:///Users/aiden/Projects/morena/AGENTS.md) 中 `## Git 提交规范` 与 `## 命名规范` 区间。
2. 在其间插入 `## 变更管理（VibeCoding）` 章节，按“Proposed Changes/章节内容”写入条目。
3. 通读一遍确保用词与 AGENTS 现有风格一致（IMPORTANT/CRITICAL 的表达保持统一）。
4. （可选）在本地运行 `pnpm validate`，确认当前仓库在规则更新后仍然可通过基础校验。

## Verification

- [ ] [AGENTS.md](file:///Users/aiden/Projects/morena/AGENTS.md) 出现新章节 `## 变更管理（VibeCoding）`，位置正确且内容完整。
- [ ] 新增内容不引入与项目约束冲突的表述（例如包管理器仍为 pnpm，网络请求仍为 Network 等）。
- [ ] （可选）`pnpm validate` 通过。
