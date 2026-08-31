-- عمود القائمة أُضيف بلا DEFAULT، فصار NULL في الصفوف القائمة لا قائمةً
-- فارغة — وشرط «القائمة فارغة» لا يطابق NULL، فتختفي تلك الصفوف من كل
-- استعلام يبحث عن غير المصنَّفين.
ALTER TABLE "employees" ALTER COLUMN "skills" SET DEFAULT ARRAY[]::"EmployeeSkill"[];
UPDATE "employees" SET "skills" = ARRAY[]::"EmployeeSkill"[] WHERE "skills" IS NULL;
ALTER TABLE "employees" ALTER COLUMN "skills" SET NOT NULL;
