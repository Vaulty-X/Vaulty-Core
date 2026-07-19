-- Data migration: canonicalize existing identity fields.
-- Email  → trim + lowercase
-- Phone  → Nigerian E.164 (+234XXXXXXXXXX)
--
-- Duplicate collisions after normalization keep the oldest row (by createdAt).
-- Newer email duplicates are rewritten with a +dup.<id> local-part tag so the
-- unique constraint can be applied; newer phone duplicates are cleared (NULL).
--
-- Updates park values under unique temporary keys first so mid-statement unique
-- conflicts (e.g. User@x and user@x both becoming user@x) cannot fail the migration.

BEGIN;

-- 1a) Park emails under unique temporary values while preserving the original
UPDATE users
SET email = id || '::' || email;

-- 1b) Apply canonical emails; disambiguate collisions
WITH ranked AS (
  SELECT
    id,
    lower(trim(split_part(email, '::', 2))) AS canonical_email,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(split_part(email, '::', 2)))
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM users
)
UPDATE users AS u
SET email = CASE
  WHEN ranked.rn = 1 THEN ranked.canonical_email
  ELSE split_part(ranked.canonical_email, '@', 1)
    || '+dup.' || u.id
    || '@'
    || split_part(ranked.canonical_email, '@', 2)
END
FROM ranked
WHERE u.id = ranked.id;

-- 2a) Park phones under unique temporary values (skip NULLs)
UPDATE users
SET "phoneNumber" = id || '::' || "phoneNumber"
WHERE "phoneNumber" IS NOT NULL;

-- 2b) Normalize to E.164 and clear newer duplicates in one pass
WITH parsed AS (
  SELECT
    id,
    "createdAt",
    CASE
      WHEN regexp_replace(split_part("phoneNumber", '::', 2), '[^0-9]', '', 'g') ~ '^234[789][0-9]{9}$'
        THEN '+' || regexp_replace(split_part("phoneNumber", '::', 2), '[^0-9]', '', 'g')
      WHEN regexp_replace(split_part("phoneNumber", '::', 2), '[^0-9]', '', 'g') ~ '^0[789][0-9]{9}$'
        THEN '+234' || substr(regexp_replace(split_part("phoneNumber", '::', 2), '[^0-9]', '', 'g'), 2)
      WHEN regexp_replace(split_part("phoneNumber", '::', 2), '[^0-9]', '', 'g') ~ '^[789][0-9]{9}$'
        THEN '+234' || regexp_replace(split_part("phoneNumber", '::', 2), '[^0-9]', '', 'g')
      ELSE split_part("phoneNumber", '::', 2)
    END AS canonical_phone
  FROM users
  WHERE "phoneNumber" IS NOT NULL
    AND "phoneNumber" LIKE '%::%'
),
ranked_phones AS (
  SELECT
    id,
    canonical_phone,
    ROW_NUMBER() OVER (
      PARTITION BY canonical_phone
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM parsed
)
UPDATE users AS u
SET "phoneNumber" = CASE
  WHEN ranked_phones.rn = 1 THEN ranked_phones.canonical_phone
  ELSE NULL
END
FROM ranked_phones
WHERE u.id = ranked_phones.id;

COMMIT;
