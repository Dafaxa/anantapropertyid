// Called once a day by the Vercel cron in vercel.json. A real read against
// Supabase keeps the free-tier project from being paused for inactivity.
const SUPABASE_URL = 'https://slunqshpbugvwgliefyo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sXrbQ0YVe492bNBtL0lzRw_MO2oieqL'; // public by design

module.exports = async (req, res) => {
  let status = 0;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/projects?select=id&limit=1',
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
    status = r.status;
  } catch (err) {
    status = -1;
  }
  res.setHeader('Cache-Control', 'public, s-maxage=600');
  res.status(status >= 200 && status < 300 ? 200 : 502).json({ ok: status >= 200 && status < 300, supabase: status, at: new Date().toISOString() });
};
