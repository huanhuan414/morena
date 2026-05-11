# Tasks
- [x] Task 1: 盘点分身模块现状链路
  - [x] SubTask 1.1: 梳理前端入口、页面职责、跳转关系与关键参数
  - [x] SubTask 1.2: 梳理后端接口、核心实体与主要状态字段
  - [x] SubTask 1.3: 确认当前真实主链与实际数据落点

- [x] Task 2: 定义分身模块统一生命周期
  - [x] SubTask 2.1: 明确发现入口、创建与回流规则
  - [x] SubTask 2.2: 明确托管运营、社交扩展与语音通话的关系
  - [x] SubTask 2.3: 明确接单、生成、发布、反馈、验收、完结的闭环顺序

- [x] Task 3: 识别关键断点并排序
  - [x] SubTask 3.1: 标记高频用户路径中的断点，如路由错误、缺参、回流缺失
  - [x] SubTask 3.2: 标记后端模型中的断点，如字段不一致、状态双轨、结果双轨
  - [x] SubTask 3.3: 按用户体验风险和后续治理价值排序问题优先级

- [x] Task 4: 输出后续收敛建议
  - [x] SubTask 4.1: 给出单一主链建议，明确后续应围绕哪条链持续演进
  - [x] SubTask 4.2: 给出单一状态源建议，明确页面和接口的边界
  - [x] SubTask 4.3: 给出页面入口、回流与验收标准建议

# Task Dependencies
- `Task 2` depends on `Task 1`
- `Task 3` depends on `Task 1`
- `Task 4` depends on `Task 2` and `Task 3`

## Implementation Sprint
- [x] Task 5: 修复分身主页与推荐页的路由参数不一致问题
  - [x] SubTask 5.1: 统一分身主页页面参数读取口径
  - [x] SubTask 5.2: 修复推荐页查看分身时的跳转参数
  - [x] SubTask 5.3: 验证其他进入分身主页的入口不受影响

- [x] Task 6: 修复好友入口上下文与用户级交友入口
  - [x] SubTask 6.1: 调整个人中心“好友”入口到合适的用户级交友页
  - [x] SubTask 6.2: 为分身好友页增加缺少 `avatarId` 时的容错或引导
  - [x] SubTask 6.3: 保持从分身管理页进入好友页的单分身上下文能力

- [x] Task 7: 修复分身创建后的页面回流刷新问题
  - [x] SubTask 7.1: 确保从创建页返回分身列表时触发重新加载
  - [x] SubTask 7.2: 保持“我的分身 / 分身广场”双 Tab 的现有行为不回退

- [x] Task 8: 验证高优先级分身闭环修复
  - [x] SubTask 8.1: 检查相关页面的类型与诊断信息
  - [x] SubTask 8.2: 回写本轮实现任务状态与完成结果

- [x] Task 9: 统一分身托管字段口径
  - [x] SubTask 9.1: 修正后端托管状态写入与读取的字段一致性
  - [x] SubTask 9.2: 修正派单推荐逻辑对托管字段的判断
  - [x] SubTask 9.3: 保持前端现有托管开关接口不回退

- [x] Task 10: 修复订单分发与详情口径错误
  - [x] SubTask 10.1: 修复订单详情读取错误分发表的问题
  - [x] SubTask 10.2: 统一分发状态统计与接单状态口径
  - [x] SubTask 10.3: 验证订单详情页相关接口返回不回退

- [x] Task 11: 修复发布引导页当前校验阻塞
  - [x] SubTask 11.1: 修复 `order-publish-guide` 中缺失的 `PLATFORM_CONFIG` 依赖
  - [x] SubTask 11.2: 验证发布引导页相关诊断恢复正常
