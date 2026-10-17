-- GitLab sign-ins were stored with email_verified = 0 (GitLab's API doesn't
-- send that flag), which blocked linking other providers to those accounts.
-- Anyone who signed in with GitLab had a confirmed GitLab email.
UPDATE `user` SET `email_verified` = 1
WHERE `email_verified` = 0
  AND `id` IN (SELECT `user_id` FROM `account` WHERE `provider_id` = 'gitlab');
