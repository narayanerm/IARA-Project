# IARA

## Deploy main

Deploy IARA runs on pushes to `main` and can be dispatched manually from
`main`. Caddy serves HTTP on port 80 and proxies to Nginx at
`127.0.0.1:8080`.

1. Register a trusted Linux self-hosted runner for this repository with the
   `iara-deploy` label. It needs Bash, OpenSSH, tar, and network access to the
   instance over SSH (TCP port 22). Use this runner only for trusted workflows.
2. In the GitHub `production` environment, restrict deployment to `main`.
   Set `DEPLOY_SSH_KEY` to a dedicated deployment key authorized on the instance
   and `DEPLOY_KNOWN_HOSTS` to the verified SSH host-key entry for
   `ec2-52-38-210-2.us-west-2.compute.amazonaws.com`.
3. Merge the workflow into `main`. In Actions, check for the message confirming
   that Caddy served the new HTML and JavaScript. This check runs on the instance
   and works with IP-restricted HTTP ingress.

For manual deployment, build with Node 22.12 or newer and run:

```sh
npm ci
npm run build
bash scripts/deploy.sh dist /path/to/deploy_key /path/to/verified_known_hosts
```

The SSH account needs write access to `/var/www/curupira` and that directory
must already contain a deployed index page. The script publishes assets before
switching the HTML entry point. A failed check restores the previous HTML.
Older hashed assets are kept for browsers still using an earlier page.
