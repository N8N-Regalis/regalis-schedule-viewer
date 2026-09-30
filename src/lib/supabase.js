import { createClient } from '@supabase/supabase-js';

// Same project as the client portal. The anon key is public by design (row-level
// security decides what it can read); override both via .env if needed.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://pzcfrocmwmhyygzgecpl.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6Y2Zyb2Ntd21oeXlnemdlY3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNDgyOTcsImV4cCI6MjEwNTkyNDI5N30.KT8tBaw4AIotucrGbHYJsUukWYp2EcSYUCMv7i2ziAw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
