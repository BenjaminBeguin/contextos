-- Collapse to three tiers: team & business fold into the single self-serve "scale" tier.
UPDATE "Workspace" SET plan = 'scale' WHERE plan IN ('team', 'business');
