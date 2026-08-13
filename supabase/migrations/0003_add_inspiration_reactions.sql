-- Add thumbs up/down reaction and "done" tracking to inspiration posts.
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

alter table inspiration_posts add column if not exists reaction text check (reaction in ('up', 'down'));
alter table inspiration_posts add column if not exists completed boolean not null default false;
