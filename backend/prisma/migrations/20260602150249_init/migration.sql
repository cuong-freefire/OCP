-- DropForeignKey
ALTER TABLE `email_verifications` DROP FOREIGN KEY `fk_email_verifications_user`;

-- DropForeignKey
ALTER TABLE `oauth_accounts` DROP FOREIGN KEY `fk_oauth_accounts_user`;

-- DropForeignKey
ALTER TABLE `password_reset_tokens` DROP FOREIGN KEY `fk_password_reset_tokens_user`;

-- DropForeignKey
ALTER TABLE `refresh_tokens` DROP FOREIGN KEY `fk_refresh_tokens_user`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `fk_users_role`;

-- AlterTable
ALTER TABLE `oauth_accounts` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `roles` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `users` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_accounts` ADD CONSTRAINT `oauth_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_verifications` ADD CONSTRAINT `email_verifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `refresh_tokens` RENAME INDEX `idx_refresh_tokens_hash` TO `refresh_tokens_token_hash_key`;

-- RenameIndex
ALTER TABLE `roles` RENAME INDEX `idx_roles_code` TO `roles_code_key`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `idx_users_email` TO `users_email_key`;
