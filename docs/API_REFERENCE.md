# Friendie Logistics API reference — user-supplied contract

Saved: 2026-11-14. Source: API contract supplied by the user in chat (37 endpoints).

Use this reference when the user requests API integration. Saving this document does not authorize integration, migrations, deployment, database changes or test writes. These endpoints and response details have not been independently verified by the mobile agent. Inspect actual responses and relevant server contracts when integration is requested; do not invent unspecified fields or endpoints. This contract supersedes guessed endpoint names in older implementation reports.

## Critical authentication blocker

The original database is missing `personal_access_tokens`. Live login/token authentication is blocked until the Sanctum migration is approved and deployed. Migration approval has NOT been granted. Do not run migrations against the original database. Test authenticated operations only in an authorized, verified isolated environment. Do not fabricate tokens or authenticated success to work around this blocker.

## Connectivity and headers

- Android emulator base URL: `http://10.0.2.2:8000/api/v1`
- Physical Android base URL: `http://<COMPUTER_LAN_IP>:8000/api/v1`
- Verify server/device connectivity. Phone `127.0.0.1` does not refer to the computer. The computer LAN IP is not supplied.
- JSON headers: `Accept: application/json`, `Content-Type: application/json`.
- Protected requests additionally require `Authorization: Bearer YOUR_LOGIN_TOKEN`.
- Uploads use multipart form data with the specified file key; allow the client to generate the multipart boundary.

## 1. Authentication — 7 endpoints

| Method | Relative endpoint | Body/authentication |
| --- | --- | --- |
| POST | `/auth/register` | Registration fields below; no CAPTCHA required |
| POST | `/auth/login` | `email`, `password` |
| POST | `/auth/forgot-password` | `email` |
| POST | `/auth/reset-password` | `user_id`, `token`, `password`, `password_confirmation` |
| POST | `/auth/resend-verification` | `email` |
| GET | `/auth/me` | Bearer token |
| POST | `/auth/logout` | Bearer token; empty body |

Registration example (example values, not real credentials):

```json
{
  "name": "Example Customer",
  "email": "customer@example.test",
  "phone": "+10000000001",
  "country_id": 1,
  "password": "ExamplePassword123!",
  "password_confirmation": "ExamplePassword123!"
}
```

Select an actual active `country_id` from `/countries`. Registration does not return a token. Email must subsequently be verified in the browser.

Login example:

```json
{"email":"customer@example.test","password":"ExamplePassword123!"}
```

Successful login response:

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "YOUR_LOGIN_TOKEN",
    "token_type": "Bearer",
    "user": {"id":1,"name":"Example Customer","email":"customer@example.test"}
  }
}
```

Read the token from `data.token`. The account must be active, verified and exclusively customer-role. This successful response is the supplied contract; original-database login remains blocked by the missing table.

## 2. Public APIs — 8 endpoints

No token required.

| Method | Relative endpoint |
| --- | --- |
| GET | `/health` |
| GET | `/home` |
| GET | `/categories?search=par` |
| GET | `/countries?search=pak` |
| GET | `/cities?country_id=1&search=kar` |
| GET | `/currencies?search=usd` |
| GET | `/listings?page=1&per_page=20` |
| GET | `/listings/{id}` |

Reference search parameters are optional. Categories, countries, cities and currencies are unpaginated. IDs must come from actual reference records.

Public listings optional filters:

```text
search, category_id, from_country_id, to_country_id,
from_city_id, to_city_id, ad_type, weight,
departure_on, sort, page, per_page
```

GPS coordinates, radius/diameter filters, area IDs and accepted-request/contact authorization endpoints are not specified in this contract. Do not assume support or silently substitute unsupported parameters. Preserve existing product privacy rules; verify additional contracts separately if requested.

## 3. Dashboard/profile — 6 protected endpoints

| Method | Relative endpoint | Body |
| --- | --- | --- |
| GET | `/customer/dashboard` | None |
| GET | `/customer/profile` | None |
| PUT | `/customer/profile` | Supported subset: `name`, `email`, `phone`, `country_id` |
| POST | `/customer/profile/avatar` | Multipart file key `avatar` |
| DELETE | `/customer/profile/avatar` | Empty |
| POST | `/customer/change-password` | Fields below |

```json
{
  "current_password": "ExamplePassword123!",
  "password": "NewExamplePassword123!",
  "password_confirmation": "NewExamplePassword123!"
}
```

Password change revokes mobile tokens; login again. Email changes require re-verification and reauthentication.

## 4. Customer listings — 7 protected endpoints

| Method | Relative endpoint |
| --- | --- |
| GET | `/customer/listings` |
| POST | `/customer/listings` |
| GET | `/customer/listings/{id}` |
| PUT | `/customer/listings/{id}` |
| DELETE | `/customer/listings/{id}` — intentionally blocked, HTTP 409 |
| POST | `/customer/listings/{id}/image` |
| DELETE | `/customer/listings/{id}/image` |

Own-listings filters: `search, status, ad_type, sort, page, per_page`.

Create example (replace all reference IDs with actual selected records):

```json
{
  "ad_type": "Carring",
  "title": "Parcel capacity",
  "description": "<p>Room for a parcel.</p>",
  "category_id": 1,
  "from_country_id": 1,
  "from_city_id": 1,
  "to_country_id": 2,
  "to_city_id": 2,
  "weight": 5,
  "weight_price": 20,
  "currency": "USD",
  "departure_on": "2030-11-20",
  "reached_on": "2030-11-21"
}
```

Exact backend ad types: **`Carring`**, **`Send`**. Preserve this spelling in the API mapping. New listings are pending. Updates accept a supported subset of fields; verify the exact subset before submitting.

Listing-image upload multipart file key: **`image`**. Both avatar and listing uploads accept JPEG/PNG/WebP, maximum **2 MiB**, maximum dimensions **2048×2048**.

## 5. Chat — 6 protected endpoints

| Method | Relative endpoint | Body |
| --- | --- | --- |
| GET | `/customer/conversations` | None |
| GET | `/customer/conversations/{id}` | None |
| GET | `/customer/conversations/{id}/messages` | None |
| POST | `/customer/conversations` | `post_ads_id`, `message` |
| POST | `/customer/conversations/{id}/messages` | `message` |
| POST | `/customer/conversations/{id}/read` | Empty |

Create conversation:

```json
{"post_ads_id":1,"message":"Is parcel capacity available?"}
```

Send message:

```json
{"message":"Please share the parcel requirements."}
```

Only authorized room participants may access a conversation. GET requests do not change read status. No upload, real-time transport or message idempotency contract is provided here; do not infer these capabilities.

## 6. Reviews — 3 protected endpoints

| Method | Relative endpoint |
| --- | --- |
| GET | `/customer/reviews/received` |
| GET | `/customer/reviews/given` |
| POST | `/customer/reviews` |

```json
{"post_ads_id":1,"rating":5,"review":"Good experience."}
```

Rating range: **0–5**. A new review is allowed only on a publicly eligible listing. Missing/nonpublic listing: **404**. Duplicate review: **409**. Self-review is rejected. Review edit/delete APIs are not supplied.

## Pagination and errors

Paginated lists default to 20 records; maximum 50. Use `?page=1&per_page=20`.

General supplied list envelope (verify endpoint-specific responses before mapping):

```json
{
  "success": true,
  "message": "...",
  "data": {
    "items": [],
    "pagination": {"current_page":1,"per_page":20,"total":0,"last_page":1}
  }
}
```

Reference APIs have no `pagination`. Exact home, dashboard, profile, detail, chat and review record shapes were not supplied.

| Status | Meaning |
| --- | --- |
| 401 | Missing/invalid/expired token or invalid login |
| 403 | Account/permission restriction |
| 404 | Missing, non-owned or inaccessible resource |
| 409 | Conflict or intentionally blocked deletion |
| 422 | Validation error |
| 429 | Rate limit exceeded |

## Intended testing order

`health → countries → register → browser email verification → login → secure token save → /auth/me → protected APIs`.

The login stage against the original database must wait for approval and deployment of the Sanctum table. Use authorized isolated testing for protected APIs. This document records the user's contract only; no endpoints were called and no application configuration or code was changed when saving it.
