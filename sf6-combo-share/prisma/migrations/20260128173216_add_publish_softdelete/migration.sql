-- DropForeignKey
ALTER TABLE `sessions` DROP FOREIGN KEY `sessions_userId_fkey`;

-- AlterTable
ALTER TABLE `combos` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `is_published` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `comments` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `is_published` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `combos_is_published_deleted_at_created_at_idx` ON `combos`(`is_published`, `deleted_at`, `created_at`);

-- CreateIndex
CREATE INDEX `comments_is_published_deleted_at_created_at_idx` ON `comments`(`is_published`, `deleted_at`, `created_at`);

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
