## Single Source of Truth

- 建议以 `server/src/storage/database/schema/schema.sql` + `server/src/storage/database/schema/migrations/*.sql` 作为数据库结构的唯一事实源。
- `server/init_database.sql` 用于历史初始化与本地快速启动参考，不保证与当前线上结构一致。
- `server/src/storage/database/schema/order_tables.sql` 属于订单域局部脚本，建议只作为局部对照，不作为全库真源。

## Applying Changes

- 只允许通过新增 `migrations/*.sql` 的方式做增量变更（尤其是索引类变更）。
- 迁移脚本应保持幂等：通过 `information_schema` 检查后再执行 `ALTER TABLE`，避免重复执行失败。

## Verification Checklist

- 新增/调整索引：提供对应查询的 `EXPLAIN`，确保走目标索引且避免 `type=ALL`。
- 变更落库后：对比 `SHOW CREATE TABLE <table>` 与 `schema.sql` / migrations 的预期一致。

