-- Add a "Views" tracker to inspiration posts.
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

alter table inspiration_posts add column if not exists views numeric;
