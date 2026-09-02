const supabaseUrl = 'https://sahezgrnpkvxamaetjcu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaGV6Z3JucGt2eGFtYWV0amN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzU0ODMsImV4cCI6MjEwMzQxMTQ4M30.88QWbyBCSVqOzn4fZXRkf2ONplOWBbyV0nFMTxAv0a4';

/// The deployment that serves the web app's API routes. Only `/api/health` is
/// used from here — it reports which integrations the server actually holds
/// tokens for, so the app never offers a channel the server cannot honour.
const apiUrl = 'https://ordo-core.vercel.app';

