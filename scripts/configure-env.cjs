const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', '.env');
const values = {};
if (fs.existsSync(file))
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (match)
      values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
const config = {
  apiBaseUrl: values.API_BASE_URL || '',
  termsUrl: values.TERMS_URL || '',
  privacyUrl: values.PRIVACY_URL || '',
  authApiVerified: values.AUTH_API_VERIFIED === 'true',
  profileApiVerified: values.PROFILE_API_VERIFIED === 'true',
  myListingsApiVerified: values.MY_LISTINGS_API_VERIFIED === 'true',
  listingsApiVerified: values.LISTINGS_API_VERIFIED === 'true',
  listingDetailsApiVerified: values.LISTING_DETAILS_API_VERIFIED === 'true',
  chatApiVerified: values.CHAT_API_VERIFIED === 'true',
  chatIdempotencyVerified: values.CHAT_IDEMPOTENCY_VERIFIED === 'true',
  navigationPreview: values.NAVIGATION_PREVIEW === 'true',
  uiPreviewEnabled: values.UI_PREVIEW_ENABLED !== 'false',
  firebaseEnabled: values.FIREBASE_ENABLED === 'true',
  placesProxyUrl: values.PLACES_PROXY_URL || '',
  placesApiVerified: values.PLACES_API_VERIFIED === 'true',
};
if (config.apiBaseUrl && !/^https?:\/\//.test(config.apiBaseUrl))
  throw Error('API_BASE_URL must use HTTP(S)');
fs.mkdirSync(path.join(__dirname, '../src/app/config'), { recursive: true });
fs.writeFileSync(
  path.join(__dirname, '../src/app/config/environment.generated.json'),
  JSON.stringify(config, null, 2) + '\n',
);
console.log('Generated public mobile configuration.');
