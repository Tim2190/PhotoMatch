import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nugixzapgicswhtuaeki.supabase.co';
const supabaseAnonKey = 'sb_publishable_kGevgEdevKM4enF33Hahjg_AnqeKNFx';


export const supabase = createClient(supabaseUrl, supabaseAnonKey);
