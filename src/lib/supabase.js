import { createClient } from "@supabase/supabase-js";

// Same project as the client portal. The anon key is public by design (row-level
// security decides what it can read); override both via .env if needed.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://nixzyeedlozlrxfquszd.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peHp5ZWVkbG96bHJ4ZnF1c3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMzA1ODgsImV4cCI6MjEwNTcwNjU4OH0.LlvQy9orvRn05R5xIflPgHA7Q5T8JEJngaJCCK91BpI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
