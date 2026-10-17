-- Usernames are now letters and digits only (lib/username.ts). Drop the "-"
-- and "_" from existing ones (e.g. the auto-assigned "emre-a1b2c" → "emrea1b2c").
-- If that would clash with another user's name (case-insensitively) or leave
-- fewer than 3 characters, part of the user id is appended so it stays unique.
UPDATE `user` SET `username` = CASE
  WHEN length(replace(replace(`username`, '-', ''), '_', '')) >= 3
   AND NOT EXISTS (
     SELECT 1 FROM `user` AS o
     WHERE o.`id` != `user`.`id`
       AND lower(replace(replace(o.`username`, '-', ''), '_', '')) = lower(replace(replace(`user`.`username`, '-', ''), '_', ''))
   )
  THEN replace(replace(`username`, '-', ''), '_', '')
  ELSE substr(replace(replace(`username`, '-', ''), '_', ''), 1, 14) || substr(`id`, 1, 6)
END
WHERE `username` LIKE '%-%' OR `username` LIKE '%\_%' ESCAPE '\';
