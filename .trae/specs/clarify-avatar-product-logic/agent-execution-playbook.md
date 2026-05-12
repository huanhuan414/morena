# Agent 执行手册

## 0. 目标

- 用一套主控 Agent + 子 Agent 的执行机制，把 `project-manager-tasks.md` 逐阶段落地。
- 确保 Agent 开发过程可管理、可回写、可验收、可恢复。
- 确保任何阶段都只有一个统一调度入口。

## 1. 执行架构

### 1.1 角色定义

- `主控 Agent`
  - 唯一调度者
  - 唯一状态回写者
  - 唯一阶段推进审批者
- `架构 Agent`
  - 负责冻结状态机、字段字典、DTO 契约、导航矩阵
- `前端 Agent`
  - 负责页面、路由、回流、状态展示、前端契约消费
- `后端 Agent`
  - 负责服务、控制器、数据库读写、状态推进、聚合逻辑
- `验证 Agent`
  - 负责诊断、构建、联调、回归结果确认

### 1.2 单一调度原则

- 不允许多个 Agent 同时修改同一阶段的同一类核心文件。
- 不允许前端 Agent 在 DTO 未冻结前先行落地页面状态兼容。
- 不允许后端 Agent 在状态机未冻结前新增状态。
- 不允许验证 Agent 在主控 Agent 未标记 `待验收` 前提前判定完成。

## 2. 文件与状态管理

### 2.1 事实源文件

- 任务总控：`project-manager-tasks.md`
- Agent 手册：`agent-execution-playbook.md`
- 执行看板：`agent-task-board.md`
- 阶段冻结文档：
  - `freeze-state-machines.md`
  - `freeze-field-dictionary.md`
  - `freeze-dto-contracts.md`
  - `freeze-navigation-matrix.md`

### 2.2 看板状态

- `pending`
- `in_progress`
- `blocked`
- `review_required`
- `completed`

### 2.3 阶段状态

- `待冻结`
- `冻结中`
- `已冻结`
- `开发中`
- `联调中`
- `待验收`
- `已完成`

## 3. 标准执行顺序

### 第 1 步：主控 Agent 读取任务与看板

- 读取：
  - `project-manager-tasks.md`
  - `agent-task-board.md`
- 找到当前阶段第一个 `pending` 或 `blocked` 已解除的任务
- 确认是否满足前置依赖

### 第 2 步：主控 Agent 分派冻结任务

- 如果当前阶段属于规则冻结类任务：
  - 先调用 `架构 Agent`
  - 输出文档到冻结文件
  - 主控 Agent 回写看板

### 第 3 步：主控 Agent 分派开发任务

- 如果任务属于前端：
  - 调用 `前端 Agent`
- 如果任务属于后端：
  - 调用 `后端 Agent`
- 如果任务跨前后端：
  - 先后端，后前端
  - 禁止同时修改同一契约

### 第 4 步：主控 Agent 组织验证

- 开发完成后，统一调用 `验证 Agent`
- 只允许在以下条件满足后标记 `review_required`：
  - 已更新代码
  - 已跑基础诊断
  - 已补充必要文档

### 第 5 步：主控 Agent 回写状态

- 更新 `agent-task-board.md`
- 更新任务状态
- 记录：
  - 实际变更文件
  - 验证结果
  - 阻塞项
  - 是否满足进入下阶段门禁

## 4. 子 Agent 调用顺序

### 4.1 冻结类任务

1. `search`
2. `架构 Agent`
3. `验证 Agent`

### 4.2 后端开发类任务

1. `search`
2. `后端 Agent`
3. `验证 Agent`

### 4.3 前端开发类任务

1. `search`
2. `前端 Agent`
3. `验证 Agent`

### 4.4 跨前后端任务

1. `search`
2. `架构 Agent`
3. `后端 Agent`
4. `前端 Agent`
5. `验证 Agent`

## 5. 同步机制

### 5.1 主控 Agent 每次执行必须做的事

- 开始前检查依赖
- 开始后把任务设为 `in_progress`
- 结束后回写：
  - 结果
  - 验证
  - 下一步

### 5.2 阻塞处理

- 若冻结文档缺失：直接标 `blocked`
- 若接口契约未定：前端任务一律 `blocked`
- 若状态机未定：状态相关开发一律 `blocked`
- 若验证失败：退回 `in_progress`

### 5.3 并行边界

- 可以并行：
  - 不共享文件的前端页面修复
  - 不共享文件的后端接口实现
  - 纯搜索分析任务
- 不可以并行：
  - 同一 DTO 的前后端同时改
  - 同一状态机的多个 Agent 同时改
  - 同一页面或同一 service 同时改

## 6. 回写格式

每个任务完成后，主控 Agent 必须回写以下字段：

- `owner`
- `status`
- `depends_on`
- `deliverables`
- `changed_files`
- `validation`
- `blockers`
- `next_action`

## 7. 完成判定

### 任务完成

同时满足：

- 代码或文档已落地
- 看板已回写
- 验证已通过
- 无未说明阻塞

### 阶段完成

同时满足：

- 阶段下所有任务均为 `completed`
- 阶段门禁全部满足
- 已有验收记录

## 8. 主控 Agent 禁止事项

- 禁止跳过阶段门禁直接推进下阶段
- 禁止未冻结先开发
- 禁止多个 Agent 输出原样并列作为最终结论
- 禁止不回写看板继续下一个任务
- 禁止只汇报建议，不改文档、不改代码、不跑验证

## 9. 主控 Agent 执行循环

1. 读取 `project-manager-tasks.md`
2. 读取 `agent-task-board.md`
3. 选中当前最优先且依赖满足的任务
4. 调用对应子 Agent
5. 合并结果
6. 跑验证
7. 回写看板
8. 判断是否进入下一个任务

## 10. 当前执行入口

- 当前默认从 `阶段 A` 开始。
- 若 `阶段 A` 未完成，禁止启动 `B/C/D/E/F/G`。
