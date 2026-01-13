
# SeaTime Tracker - API Configuration Guide

## Developer Configuration Required

The MyShipTracking API key is now configured as a **developer-only variable** and is not accessible to end users.

### How to Set the API Key

1. Open `utils/seaTimeApi.ts`
2. Find the following line near the top of the file:

```typescript
const MYSHIPTRACKING_API_KEY = 'YOUR_MYSHIPTRACKING_API_KEY_HERE';
```

3. Replace `'YOUR_MYSHIPTRACKING_API_KEY_HERE'` with your actual MyShipTracking API key:

```typescript
const MYSHIPTRACKING_API_KEY = 'your-actual-api-key-from-myshiptracking';
```

4. Save the file and rebuild the app

### Getting a MyShipTracking API Key

1. Visit [MyShipTracking](https://www.myshiptracking.com/)
2. Sign up for an account or log in
3. Navigate to the API section to obtain your API key
4. Copy the API key and paste it into `utils/seaTimeApi.ts` as described above

### Security Notes

- The API key is **hardcoded in the frontend** and sent to the backend via the `X-API-Key` header
- Users **cannot view or modify** the API key through the app interface
- The Settings screen has been **removed** - users can no longer configure API keys
- The API key is included in the app bundle, so it should be considered **semi-public**
- For production apps, consider moving the API key to environment variables or a secure backend configuration

### Changes Made

1. **Removed Settings Screen**: The settings tab and all related UI have been removed
2. **Hardcoded API Key**: API key is now set as a constant in `utils/seaTimeApi.ts`
3. **Backend Updated**: Backend now reads API key from `X-API-Key` request header instead of database
4. **No User Access**: Users cannot view, modify, or configure the API key

### Testing

After setting your API key:

1. Rebuild the app: `npm run dev`
2. Add a vessel with a valid MMSI
3. Activate the vessel
4. Click "Check Vessel" to verify AIS data is being fetched correctly
5. If you see an error about API key configuration, double-check that you've set the key in `utils/seaTimeApi.ts`

### Troubleshooting

**Error: "MyShipTracking API key not configured"**
- Make sure you've replaced `'YOUR_MYSHIPTRACKING_API_KEY_HERE'` with your actual API key
- Rebuild the app after making changes

**Error: "Failed to connect to MyShipTracking API"**
- Verify your API key is valid
- Check your internet connection
- Ensure MyShipTracking API is accessible

**No data returned for vessel**
- Verify the MMSI is correct
- Check that the vessel is broadcasting AIS data
- Try a different vessel MMSI to test
