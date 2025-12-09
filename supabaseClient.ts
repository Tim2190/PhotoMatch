import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nugixzapgicswhtuaeki.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Z2l4emFwZ2ljc3dodHVhZWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM3NzEzMjAsImV4cCI6MjA0OTM0NzMyMH0.kGevgEdevKM4enF33Hahjg_AnqeKNFxWxV7kh9YRUeY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);