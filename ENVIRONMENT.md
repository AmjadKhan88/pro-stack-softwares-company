# Environment variables (names only — never commit values)

| Name                              | Public? | Phase | Purpose                                 |
| --------------------------------- | ------- | ----- | --------------------------------------- |
| NODE_ENV                          | -       | 1     | runtime mode                            |
| NEXT_PUBLIC_APP_URL               | yes     | 1     | canonical site URL                      |
| MONGODB_URI                       | no      | 1     | Atlas connection string                 |
| MONGODB_DB_NAME                   | no      | 1     | database name                           |
| LOG_LEVEL                         | no      | 1     | Pino level                              |
| BETTER_AUTH_SECRET                | no      | 3     | session signing secret                  |
| BETTER_AUTH_URL                   | no      | 3     | auth base URL                           |
| OWNER_BOOTSTRAP_EMAIL             | no      | 3     | one-time owner seed target              |
| GMAIL_USER                        | no      | 3     | Gmail address for free SMTP             |
| GMAIL_APP_PASSWORD                | no      | 3     | 16-char Google App Password             |
| EMAIL_FROM                        | no      | 3     | sender address (optional)               |
| CLOUDINARY_CLOUD_NAME             | no      | 6     | server-side media config                |
| CLOUDINARY_API_KEY                | no      | 6     | signed uploads                          |
| CLOUDINARY_API_SECRET             | no      | 6     | signed uploads (never in client bundle) |
| NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME | yes     | 6     | image URLs                              |
| NEXT_PUBLIC_REALTIME_URL          | yes     | 7     | WSS endpoint (not a secret)             |
| REALTIME_TOKEN_SECRET             | no      | 7     | signs socket auth tokens                |
| SENTRY_DSN                        | no      | 8     | error tracking                          |
| IP_HASH_SALT                      |         | no    | 32+                                     | random characters for hashing |
| NEXT_PUBLIC_ALLOW_INDEXING        | yes     | false | until launch                            |

Rules: `lib/env.ts` validates with Zod at startup; missing integration keys produce a clear setup message. `.env*` is git-ignored; ship `.env.example` with empty values.
