# Security policy

## Reporting a vulnerability

Please do not publish exploitable security details in a public issue. Contact the repository maintainer privately through the contact method listed on the GitHub profile. Include reproduction steps and the affected CineTrack version.

## Sensitive data

- Never commit TMDB credentials, `.env` files, `settings.json`, local databases, or personal media paths.
- Treat local media deletion as destructive; keep explicit confirmation and source-root boundary checks.
- CineTrack stores its TMDB credential in a local settings file. Anyone with access to that user account may be able to read it.
- VLC's HTTP control interface must remain bound to loopback (`127.0.0.1`); do not expose it to a network.
