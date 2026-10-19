-- The profile's Full Name was left empty at sign-up while the account name
-- was set (from Google/GitHub/GitLab, or the email's local part for email
-- sign-ups), so the menu and the profile disagreed. Copy the account name
-- into empty Full Names (never a whole email address).
UPDATE `user` SET `full_name` = substr(trim(`name`), 1, 60)
WHERE (`full_name` IS NULL OR trim(`full_name`) = '')
  AND `name` IS NOT NULL AND trim(`name`) <> '' AND instr(`name`, '@') = 0;
