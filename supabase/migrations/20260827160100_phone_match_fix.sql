-- =========================================================
-- PetMatch NG — Fix lead-conversion phone matching for +234 vs 0
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- link_lead_by_phone (previous migration) compared digits_only(phone)
-- directly, which fails on the single most common real-world mismatch
-- for this market: a Nigerian number entered as "+234 801 234 5678"
-- on one form and "0801 234 5678" on another. Both are the same
-- number. Caught by testing the RPC live with realistic differently-
-- formatted input, not by reading the code — it looked correct.
-- =========================================================

-- Canonical last-10-digits: strips a leading "234" country code or a
-- leading "0" trunk prefix, whichever is present, so both formats of
-- the same Nigerian number collapse to one comparable value. Falls
-- back to whatever digits exist for shorter/foreign numbers rather
-- than erroring.
create or replace function public.phone_last10(text)
returns text
language sql
immutable
as $$
  select right(
    case
      when digits_only($1) like '234%' then substring(digits_only($1) from 4)
      when digits_only($1) like '0%' then substring(digits_only($1) from 2)
      else digits_only($1)
    end,
    10
  );
$$;

create or replace function public.link_lead_by_phone(pet_id uuid, pet_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads
  set converted_pet_id = pet_id, status = 'converted'
  where capture_source = 'waitlist'
    and status not in ('converted','dismissed')
    and phone_last10(phone) <> ''
    and phone_last10(phone) = phone_last10(pet_phone);
end;
$$;
