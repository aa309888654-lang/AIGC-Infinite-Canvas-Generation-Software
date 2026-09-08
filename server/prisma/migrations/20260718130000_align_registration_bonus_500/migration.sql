-- Align the persisted runtime setting with the 500-point registration offer.
-- Existing deployments may still have the legacy 200-point override, which
-- takes precedence over the application default until it is migrated.
UPDATE "system_configs"
SET "value" = '500', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'points_registration_bonus';
