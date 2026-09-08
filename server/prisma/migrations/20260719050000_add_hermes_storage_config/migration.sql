-- Persist the Hermes per-user archive quota. Mimomi and Hermes remain in the
-- same admin configuration section while using separate storage namespaces.
INSERT INTO "system_configs" (
  "id",
  "key",
  "value",
  "description",
  "createdAt",
  "updatedAt"
) VALUES (
  'config-hermes-storage-limit-bytes',
  'points_hermes_storage_limit_bytes',
  '1073741824',
  'Hermes 计划、步骤和执行结果归档的独立存储配额，默认 1GB',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
