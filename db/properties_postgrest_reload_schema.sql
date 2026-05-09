-- Run once after altering `properties` (or any table) if API responses still omit new columns.
-- Safe to run anytime.

notify pgrst, 'reload schema';
