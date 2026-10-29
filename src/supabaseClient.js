import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://frpaccphwemeejyajbyt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycGFjY3Bod2VtZWVqeWFqYnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDg3MTksImV4cCI6MjEwNjc4NDcxOX0.GM3Kv9g3d408VhA1xo0CJMO30JR8Kf-AZnvVOMUQGJo';

export const supabase = createClient(supabaseUrl, supabaseKey);