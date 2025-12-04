/*
  Warnings:

  - You are about to drop the column `description` on the `tags` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `tags` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `tags` DROP COLUMN `description`;

-- CreateIndex
CREATE UNIQUE INDEX `tags_name_key` ON `tags`(`name`);
