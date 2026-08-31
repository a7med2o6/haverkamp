-- CreateEnum
CREATE TYPE "EmployeeSkill" AS ENUM ('TINT', 'PROTECTION', 'PAINT', 'CLEANING', 'GLASS', 'BUFFET', 'DRIVER', 'MANAGEMENT');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "skills" "EmployeeSkill"[];
