# Boost Rx preview

Clickable design mockup of the Boost Rx self-monitoring website. Sample data only; not a live study site.

Live: https://abigailkamenetsky.github.io/boostrx-preview/

Backend preview: http://localhost:4000

## Local backend

This repo now includes a lightweight Express API for authentication and study data.

Run it locally:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
npm install
npm start
```

Demo credentials:

- Admin: admin@boostrx.test / admin123
- Participant: linda@boostrx.test / patient123

API examples:

- GET /api/health
- POST /api/auth/login
- GET /api/participants
- GET /api/admin/summary
- POST /api/participants/:id/checkin

## Notes

- This is still a design/mockup implementation and sample data only.
- The public domain (for example boostrx.org) is not required to build and test the backend or preview locally.
- The domain is a final branding/launch step, not a prerequisite for engineering the app.
