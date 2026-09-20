-- The Documents & files screen uses the established booking/file privacy model
-- while also supporting standalone personal, immigration, travel, and work files.
alter type public.booking_type add value if not exists 'PASSPORT';
alter type public.booking_type add value if not exists 'IMMIGRATION';
alter type public.booking_type add value if not exists 'TRAVEL_DOCUMENT';
alter type public.booking_type add value if not exists 'WORK_DOCUMENT';
alter type public.booking_type add value if not exists 'PERSONAL_DOCUMENT';
alter type public.booking_type add value if not exists 'OTHER_DOCUMENT';

alter table public.booking_files drop constraint if exists booking_files_mime_type_check;
alter table public.booking_files add constraint booking_files_mime_type_check check (
  mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  )
);
