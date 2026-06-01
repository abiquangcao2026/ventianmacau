# Hosting deploy

Use these settings when deploying the project from the repository root.

## Build command

```sh
npm run build
```

This installs backend production dependencies, installs frontend dependencies, and builds `frontend/dist`.

## Start command

```sh
npm start
```

This starts the existing backend entry through `index.js`, which loads `backend/server.js`.

## Required environment variables

Set the same production environment variables currently used by the VPS backend, including:

```txt
PORT
MONGO_URI
JWT_SECRET
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_FULL_NAME
FRONTEND_ORIGINS
MAINTENANCE_MODE
```

Do not commit real secrets into the repository.

## Notes

- This does not change game logic, sockets, betting results, or APIs.
- Static frontend files are served from `frontend/dist` by `backend/server/index.js`.
- Uploaded files and database data must be managed separately from source deploys.
