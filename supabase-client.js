// supabase-client.js
// This file is loaded by every page that needs database access

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://xxdkchgizvpdwjszwfby.supabase.co';  // Replace this
const SUPABASE_ANON_KEY = 'eyJ...YOUR-ANON-KEY...';          // Replace this

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
