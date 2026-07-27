-- =====================================================================
-- Migration 0056: Dietary tags per product
--
-- diet_tags text[] on products: 'veg', 'non-veg', 'vegan', 'organic',
-- 'egg-free', 'gluten-free'. Powers the veg/non-veg dot and the shop's dietary
-- filter chips. Applied live to project bjevoybwufubtprkxbvb.
-- =====================================================================
alter table public.products
  add column if not exists diet_tags text[] not null default '{}';
