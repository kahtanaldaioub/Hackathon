# Thunder Client: Auth and JWT smoke tests

These requests test the implemented login, access-token guard, refresh-token rotation, logout, and request validation.

## Before testing

1. Make sure MongoDB is reachable through `MONGODB_URI` in the server's local `.env`.
2. Set `JWT_SECRET` in that `.env` to a private random value at least 32 characters long. Do not put this signing secret in Thunder Client.
3. Set `DEFAULT_ADMIN_PASSWORD` in `.env` to the password for the initial admin. The default email is `admin@localhost`; override it with `DEFAULT_ADMIN_EMAIL` if needed. The seed does not change the password of an admin that already exists.
4. Start the server:

   ```powershell
   npm run start:dev
   ```

5. In Thunder Client, create a local environment with:

   | Variable | Value |
   | --- | --- |
   | `baseUrl` | `http://localhost:3000` (change if using another port) |
   | `adminEmail` | The configured admin email |
   | `adminPassword` | The configured admin password |
   | `accessToken` | Leave empty initially |
   | `refreshToken` | Leave empty initially |
   | `oldRefreshToken` | Leave empty initially |

Keep the environment local and do not commit/export it with real credentials or tokens.

For each request below, use **JSON** as the body format when a body is shown. Thunder Client should send `Content-Type: application/json`.

## 1. Confirm user routes require authentication

- **Method:** `GET`
- **URL:** `{{baseUrl}}/users`
- **Authorization:** None

Expected: **401 Unauthorized**.

## 2. Log in as the seeded admin

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/login`
- **Body:**

  ```json
  {
    "email": "{{adminEmail}}",
    "password": "{{adminPassword}}"
  }
  ```

Expected: **200 OK**, with `accessToken`, `refreshToken`, `tokenType`, `expiresIn`, `refreshExpiresIn`, and a `user` object. The default lifetimes are 900 seconds for access tokens and 2,592,000 seconds for refresh tokens.

Copy `accessToken` and `refreshToken` from the response into the corresponding Thunder Client environment variables. Do not include surrounding quotation marks.

To check invalid credentials, repeat the request with a wrong password. Expected: **401 Unauthorized**.

## 3. Use the access token

- **Method:** `GET`
- **URL:** `{{baseUrl}}/users`
- **Authorization:** Bearer token `{{accessToken}}`

Expected: **200 OK**. The current users service is still a scaffold placeholder, so the response is not a MongoDB user listing yet; this request verifies the admin JWT guard.

## 4. Check request validation

- **Method:** `POST`
- **URL:** `{{baseUrl}}/users`
- **Authorization:** Bearer token `{{accessToken}}`
- **Body:**

  ```json
  {
    "unexpected": "value"
  }
  ```

Expected: **400 Bad Request** because the current create-user DTO does not declare this field.

## 5. Rotate the refresh token

Before sending the request, copy the current `refreshToken` value into `oldRefreshToken`.

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/refresh`
- **Body:**

  ```json
  {
    "refreshToken": "{{refreshToken}}"
  }
  ```

Expected: **200 OK** with a new access and refresh token. Replace the `accessToken` and `refreshToken` environment values with the newly returned values.

Now replay the old refresh token:

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/refresh`
- **Body:**

  ```json
  {
    "refreshToken": "{{oldRefreshToken}}"
  }
  ```

Expected: **401 Unauthorized** because refresh tokens are rotated and the previous token can no longer be used.

## 6. Log out

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/logout`
- **Body:**

  ```json
  {
    "refreshToken": "{{refreshToken}}"
  }
  ```

Expected: **204 No Content**.

Try `/auth/refresh` again with that logged-out refresh token. Expected: **401 Unauthorized**.

Logout revokes the refresh session. An access token already issued remains valid until it expires (15 minutes by default).

## Implemented endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | Verify admin credentials and issue access/refresh tokens |
| `POST` | `/auth/refresh` | Rotate a refresh token |
| `POST` | `/auth/logout` | Revoke the supplied refresh session |
| `GET`, `POST`, `PATCH`, `DELETE` | `/users...` | Admin-only routes; their handlers are still scaffold placeholders |

Public signup is disabled. User-management routes require an admin access token.
