import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nugixzapgicswhtuaeki.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Z2l4emFwZ2ljc3dodHVhZWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjA0NjEsImV4cCI6MjA4MDgzNjQ2MX0.BD-ZCo7uBGhSwv8eAOAwItm1xOdpPROAV5SFOWkKj2Q';


export const supabase = createClient(supabaseUrl, supabaseAnonKey);

