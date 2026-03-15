# Country Persistence Test Plan

## Current Implementation Analysis:

### Storage Layer (storage.ts):
1. `getSettings()` - Loads settings from `user_settings` table (line 1056-1177)
   - Reads `country` field from database
   - Falls back to 'IT' if no data found
   
2. `saveSettings()` - Saves settings to `user_settings` table (line 1179-1225)
   - Maps `settings.country` to database column `country`
   - Uses upsert with `user_id` conflict resolution

### UI Layer (SettingsSection.tsx):
1. `handleCountryChange()` - Called when country is changed (line 38-75)
   - Updates local state
   - Calls `saveSettings()` immediately
   - Notifies parent component

### App Layer (Index.tsx):
1. `loadAllData()` - Loads settings on mount (line 107-155)
   - Calls `getSettings()` from storage
   - Sets settings state
   
2. Settings are loaded when:
   - User logs in (useEffect with user dependency)
   - User changes (logout/login detected)

## Expected Behavior:
1. User selects UK as country
2. Settings saved to Supabase user_settings table
3. User logs out
4. User logs back in
5. Settings loaded from Supabase
6. Country should be UK (not IT)

## Verification Steps:
1. Check if user_settings table exists in Supabase
2. Verify country column exists
3. Test the flow manually
