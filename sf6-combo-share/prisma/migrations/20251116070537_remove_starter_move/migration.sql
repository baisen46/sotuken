/*
  Warnings:

  - You are about to drop the column `starter_move_id` on the `combos` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `combos` DROP FOREIGN KEY `combos_starter_move_id_fkey`;

-- DropIndex
DROP INDEX `combos_starter_move_id_fkey` ON `combos`;

-- AlterTable
ALTER TABLE `combos` DROP COLUMN `starter_move_id`;
