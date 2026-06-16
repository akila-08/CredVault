-- Fix existing credentials: normalise all wallet addresses to lowercase
-- Run this once in your Supabase SQL Editor (supabase.com → SQL Editor)

UPDATE credentials
SET
  student_wallet    = LOWER(student_wallet),
  university_wallet = LOWER(university_wallet)
WHERE
  student_wallet    <> LOWER(student_wallet)
  OR university_wallet <> LOWER(university_wallet);

-- (Optional) Verify — should return 0 rows after migration:
-- SELECT id, student_wallet, university_wallet FROM credentials
-- WHERE student_wallet <> LOWER(student_wallet)
--    OR university_wallet <> LOWER(university_wallet);
