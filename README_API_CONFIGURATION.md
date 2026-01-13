
# MyShipTracking API Configuration

## Current Issue

The "Check AIS Status" feature is currently returning an error because the MyShipTracking API key is not properly configured on the backend.

## Error Messages You May See

- **"MyShipTracking API Configuration Required"** - The API key is not set or is invalid
- **"Vessel Not Found in AIS System"** - The MMSI number may be incorrect, or the vessel is not broadcasting AIS
- **"AIS Service Temporarily Unavailable"** - The MyShipTracking API is experiencing downtime

## How to Fix

### For Developers

The backend needs a valid MyShipTracking API key to be configured:

1. **Get an API Key:**
   - Visit [myshiptracking.com](https://www.myshiptracking.com/)
   - Sign up for an account
   - Obtain your API key from the dashboard

2. **Configure the Backend:**
   - Set the environment variable `MYSHIPTRACKING_API_KEY` on your backend server
   - The backend will automatically use this key for all AIS requests

3. **Verify Configuration:**
   - Check the backend logs on startup - it should show "API key configured: true"
   - Test the "Check AIS Status" button with a known valid MMSI

### For Users

If you see an error when checking AIS status:

1. **Verify MMSI Number:**
   - Make sure the MMSI number is correct (9 digits)
   - You can verify MMSIs on [marinetraffic.com](https://www.marinetraffic.com/) or [vesselfinder.com](https://www.vesselfinder.com/)

2. **Check Vessel is Broadcasting:**
   - The vessel must be actively transmitting AIS signals
   - The vessel must be within AIS coverage range

3. **Contact Support:**
   - If the MMSI is correct and the vessel is broadcasting, contact the app developer
   - The API key may need to be configured or renewed

## Technical Details

### Backend Configuration

The backend (`backend/src/routes/ais.ts`) reads the API key from:
```javascript
const MYSHIPTRACKING_API_KEY = process.env.MYSHIPTRACKING_API_KEY || 'YOUR_MYSHIPTRACKING_API_KEY_HERE';
```

### API Endpoint

The backend calls:
```
GET https://api.myshiptracking.com/v1/vessels/{MMSI}/position
Authorization: Bearer {API_KEY}
```

### Response Codes

- **200** - Success, vessel data returned
- **401** - Invalid API key
- **404** - Vessel not found in AIS system
- **502** - API service unavailable

## Testing

To test if the API is working:

1. Add a vessel with a known active MMSI (e.g., a large commercial vessel)
2. Set it as active
3. Click "Check AIS Status"
4. You should see the vessel's current position and speed

## Support

For issues with:
- **API Configuration** - Contact the backend developer
- **MMSI Verification** - Use online vessel tracking services
- **App Functionality** - Check the app logs for detailed error messages
