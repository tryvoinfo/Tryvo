import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wbcdiewohpngqbeqrfmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_d21wos13j9x7K-w1h8vsvw_0gPm_jlY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);