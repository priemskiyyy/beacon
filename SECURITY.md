# Security

Report a vulnerability privately through [GitHub's private vulnerability reporting](https://github.com/priemskiyyy/beacon/security/advisories/new), not in a public issue. Include the package and its version, the adapter, routes and options involved, and the smallest example that shows the problem, with URLs that carry credentials, tokens, account identifiers and personal data removed.

Fixes go into the latest release of each package, as a new patch version with its changelog entry. The advisory is published once that release is on npm.

Beacon decides nothing about access. An offer says what an authority wants and what a provider allows; it is never an authorization boundary, and an accepted command proves a request was made, not that anything was installed. A manifest can name a release but cannot register, choose or configure a command: commands are code the application supplied, and no remote document can change a provider's update URL, headers, channel, signing or anti-bricking settings. Diagnostic events carry no scope key, manifest, URL or provider payload, but what the application's own client logs or caches is up to that client.
