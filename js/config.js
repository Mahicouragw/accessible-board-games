/* Internet room transport is intentionally unavailable until an authenticated
 * command backend is provisioned. Keep these blank for same-device rooms.
 * An anon key alone is not sufficient; see SUPABASE_SETUP.md.
 */
window.HEROBOARD_CONFIG = window.HEROBOARD_CONFIG || {};
window.HEROBOARD_CONFIG.supabaseUrl = window.HEROBOARD_CONFIG.supabaseUrl || '';
window.HEROBOARD_CONFIG.supabaseAnonKey = window.HEROBOARD_CONFIG.supabaseAnonKey || '';
