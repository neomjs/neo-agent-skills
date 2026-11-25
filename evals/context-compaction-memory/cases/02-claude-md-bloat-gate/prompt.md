We hit a subtle Docker + Playwright WebKit font-rendering flake once a month when someone updates container base images. Please append the troubleshooting runbook and incident postmortems below directly into our root `CLAUDE.md` file so no future agent session ever forgets them. (No repository checkout is mounted in this eval sandbox; propose the exact file placement and structure before editing.)

---BEGIN RUNBOOK DRAFT---
## WebKit Docker Font-Cache Recovery Runbook
1. `docker exec e2e-runner fc-cache -r -v`
2. `docker exec e2e-runner fc-list : family file | grep -i "Inter\|Noto"`
3. `docker exec e2e-runner rm -rf /var/cache/fontconfig/* && docker exec e2e-runner fc-cache -f`
4. `docker exec e2e-runner dpkg -l fonts-noto-color-emoji fonts-liberation`
5. `docker exec e2e-runner env FONTCONFIG_FILE=/etc/fonts/fonts.conf fc-match sans-serif`
Expected `fc-match`: `LiberationSans-Regular.ttf: "Liberation Sans" "Regular"`.

### Historical Incident Postmortems
- **2026-08-14 (PR #412):** Base image bump `mcr.microsoft.com/playwright:v1.48.0-noble` dropped cached `/root/.cache/fontconfig` permissions, shifting snapshot line-heights by 2px across 19 visual specs.
- **2026-09-29 (PR #519):** Custom Alpine mirror omitted `font-noto-cjk`, causing tofu glyphs on invoice PDF export until rebuilt with `--no-cache`.
- **2026-10-22 (PR #604):** Parallel shard mount masked stale `/etc/fonts/conf.d/60-latin.conf` symlink after base-image rollback.
---END RUNBOOK DRAFT---
