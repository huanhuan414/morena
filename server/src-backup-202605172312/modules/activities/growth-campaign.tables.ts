import { getMySQLClient } from '../../storage/database/mysql-client'

export async function ensureGrowthCampaignTables(): Promise<void> {
  const db = getMySQLClient()
  await db.query(
    `CREATE TABLE IF NOT EXISTS growth_campaigns (
      id VARCHAR(36) PRIMARY KEY,
      enabled TINYINT(1) DEFAULT 0,
      title VARCHAR(200) DEFAULT '',
      description TEXT,
      start_at DATETIME NULL,
      end_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  )
  await db.query(
    `CREATE TABLE IF NOT EXISTS growth_campaign_events (
      id VARCHAR(36) PRIMARY KEY,
      campaign_id VARCHAR(36) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      user_id VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_campaign_event (campaign_id, event_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  )
}
