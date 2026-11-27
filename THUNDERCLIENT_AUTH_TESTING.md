# Thunder Client: API, auth, and user smoke tests

These requests exercise the `/api` routes, MongoDB health check, account
registration, JWT authentication, and administrator-only user CRUD.

## Before testing

1. Make sure MongoDB is reachable through `MONGODB_URI` in the server's local `.env`.
2. Set `JWT_SECRET` in `.env` to a private random value at least 32 characters long. Do not put this signing secret in Thunder Client.
3. Set `DEFAULT_ADMIN_PASSWORD` in `.env` to the password for the initial admin. The default email is `admin@localhost`; override it with `DEFAULT_ADMIN_EMAIL` if needed. The seed does not change the password of an admin that already exists.
4. Start the server:

   ```powershell
   npm run start:dev
   ```

5. In Thunder Client, create a local environment:

   | Variable | Value |
   | --- | --- |
   | `baseUrl` | `http://localhost:3000` (change if using another port) |
   | `adminEmail` | The configured admin email |
   | `adminPassword` | The configured admin password |
   | `accessToken` | Leave empty initially |
   | `refreshToken` | Leave empty initially |
   | `oldRefreshToken` | Leave empty initially |
   | `userEmail` | A unique test email, such as `new-user@example.com` |
   | `userPassword` | A test password with at least 12 characters |
   | `userAccessToken` | Leave empty initially |
   | `userRefreshToken` | Leave empty initially |
   | `userId` | Leave empty initially |
   | `crudUserEmail` | A unique email for the CRUD example |

Keep the environment local and do not commit/export it with real credentials or tokens.

For each request below, use **JSON** as the body format when a body is shown. Thunder Client should send `Content-Type: application/json`.

## 1. Check API and database health

- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/health`

Expected: **200 OK** with `status: "ok"` and `details.database.status: "up"`. A database connection problem returns **503 Service Unavailable**.

## 2. Register a regular user

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/register`
- **Body:**

  ```json
  {
    "email": "{{userEmail}}",
    "password": "{{userPassword}}"
  }
  ```

Expected: **201 Created**, with access and refresh tokens and a `user` object whose `role` is `user`. Save the returned tokens as `userAccessToken` and `userRefreshToken`. Registration does not accept a role field. Registering an email that already exists returns **409 Conflict**.

Verify regular users cannot manage users:

- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/users`
- **Authorization:** Bearer token `{{userAccessToken}}`

Expected: **403 Forbidden**.

## 3. Log in as the seeded admin

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/login`
- **Body:**

  ```json
  {
    "email": "{{adminEmail}}",
    "password": "{{adminPassword}}"
  }
  ```

Expected: **200 OK**, with `accessToken`, `refreshToken`, `tokenType`, `expiresIn`, `refreshExpiresIn`, and a `user` object. The default lifetimes are 900 seconds for access tokens and 2,592,000 seconds for refresh tokens.

Copy the returned tokens into `accessToken` and `refreshToken`. Do not include surrounding quotation marks. A wrong password should return **401 Unauthorized**.

## 4. Read users as admin

- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/users`
- **Authorization:** Bearer token `{{accessToken}}`

Expected: **200 OK** with an array of users. Each entry contains `id`, `email`, and `role`; password hashes are never returned.

To confirm authentication is required, repeat without authorization. Expected: **401 Unauthorized**.

## 5. Create, read, update, and delete a user

Create a user:

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/users`
- **Authorization:** Bearer token `{{accessToken}}`
- **Body:**

  ```json
  {
    "email": "{{crudUserEmail}}",
    "password": "a-secure-test-password",
    "role": "user"
  }
  ```

Expected: **201 Created** with `id`, `email`, and `role`. Copy the returned `id` into `userId`. The optional `role` can be `user` or `admin`; only admins can call this endpoint.

Read that user:

- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/users/{{userId}}`
- **Authorization:** Bearer token `{{accessToken}}`

Expected: **200 OK** with the user fields.

Update the user's email:

- **Method:** `PATCH`
- **URL:** `{{baseUrl}}/api/users/{{userId}}`
- **Authorization:** Bearer token `{{accessToken}}`
- **Body:**

  ```json
  {
    "email": "crud-user-updated@example.com"
  }
  ```

Expected: **200 OK** with the updated user.

Delete the user:

- **Method:** `DELETE`
- **URL:** `{{baseUrl}}/api/users/{{userId}}`
- **Authorization:** Bearer token `{{accessToken}}`

Expected: **204 No Content**. Reading the deleted ID should return **404 Not Found**. Invalid MongoDB IDs return **400 Bad Request**.

## 6. Check request validation

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/users`
- **Authorization:** Bearer token `{{accessToken}}`
- **Body:**

  ```json
  {
    "unexpected": "value"
  }
  ```

Expected: **400 Bad Request** because unknown fields are rejected and the required email and password are missing.

## 7. Rotate and revoke refresh tokens

Before rotating, copy the current `refreshToken` into `oldRefreshToken`.

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/refresh`
- **Body:**

  ```json
  {
    "refreshToken": "{{refreshToken}}"
  }
  ```

Expected: **200 OK** with new access and refresh tokens. Replace the environment values with the newly returned tokens.

Replay `oldRefreshToken` using the same refresh request. Expected: **401 Unauthorized** because rotated refresh tokens cannot be reused.

Log out using the current refresh token:

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/logout`
- **Body:**

  ```json
  {
    "refreshToken": "{{refreshToken}}"
  }
  ```

Expected: **204 No Content**. Refreshing that logged-out token should return **401 Unauthorized**. An access token already issued remains valid until it expires (15 minutes by default).

## Implemented endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check application and MongoDB health |
| `POST` | `/api/auth/register` | Register a regular user and issue tokens |
| `POST` | `/api/auth/login` | Verify credentials and issue access/refresh tokens |
| `POST` | `/api/auth/refresh` | Rotate a refresh token |
| `POST` | `/api/auth/logout` | Revoke the supplied refresh session |
| `GET`, `POST` | `/api/users` | List users or create a user (admin only) |
| `GET`, `PATCH`, `DELETE` | `/api/users/:id` | Read, update, or delete a user (admin only) |
