# Testing Update Notice Design

## Purpose

During testing, every user should see a short, non-technical summary of each new app update after they sign in. Each user sees a given update once, then sees the next notice only after a later release provides a new update ID.

## User experience

- After a successful login, show a small centered popup titled **What's New** when the signed-in user has not yet seen the current update.
- Show a short date, a plain-language title, and a concise list of user-facing changes.
- Include only one clear action: **Got it**.
- Selecting **Got it**, closing the popup, or pressing Escape records that the signed-in user has seen the current update.
- Never show code terms, internal version values, commit details, or developer-only information.
- Do not show the notice again for that user until the update ID changes.

## Update content

The app will keep the active notice in one dedicated source file. It contains:

- a unique update ID;
- a user-friendly date and title; and
- a short list of straightforward change descriptions.

For every testing-phase release that changes the app, the developer updates this content before publishing. The update ID must change for a new notice to appear.

## Remembering who has seen it

The app stores a viewed marker in the browser for the signed-in account and the current update ID. This keeps the notice from repeating for the same user while still allowing every user on their own device to see it once.

## Accessibility and resilience

- Use an accessible dialog with a clear title, keyboard dismissal, and a visible close action.
- Keep the popup compact and readable on phones and desktops.
- If browser storage is unavailable, the app still works; the notice may repeat on later logins.

## Verification

Automated tests will confirm that the notice appears for a newly signed-in user, remains dismissed after acknowledgement, is kept separate between users, and appears again after the update ID changes.

## Maintenance guide

Create a Markdown guide beside the implementation that makes the following release step mandatory during testing:

1. Write a short update title and user-facing bullets for the change.
2. Change the update ID.
3. Check that the words describe what users can now do or see, not how the code changed.
4. Test the popup with a fresh user and a returning user.
