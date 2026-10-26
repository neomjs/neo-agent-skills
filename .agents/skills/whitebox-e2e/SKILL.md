---
name: whitebox-e2e
description: "Guide for Whitebox End-to-End tests with the Neural Link Playwright fixture; use before writing, modifying, or running Playwright E2E tests, adding E2E coverage, or testing a component holistically."
---
# Whitebox E2E Testing Protocol

If you are tasked with writing new End-to-End tests for Neo.mjs applications, you MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/whitebox-e2e/references/whitebox-e2e-protocol.md` before planning your assertions or writing any test code.

**CRITICAL:** Neo.mjs uses Playwright in a highly custom way and standard Playwright patterns will fail; this protocol prevents brittle, visual-only DOM locator tests by utilizing the deep-state introspection capabilities of the Neural Link fixture.
