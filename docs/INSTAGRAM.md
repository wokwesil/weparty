# Instagram in WeParty

## What Meta's official APIs allow (checked November 2026)

- **Instagram Basic Display API** (the old way to read a personal account's
  username and photo) was shut down by Meta on December 4, 2024.
- **Instagram API with Instagram Login** only works for **Business and Creator**
  accounts, needs Meta App Review, and is built for managing a business's own
  content. It can't be used to read ordinary guests' profiles.
- There is **no official API to send Instagram DMs to people on someone's
  behalf**, and no web API to post to someone's Story.
- Scraping profile pictures from instagram.com is against Meta's terms.

## What WeParty does instead

- Guests **type their username** (we accept `@name`, `name` or a full
  instagram.com link) and can **upload a profile photo** from their phone. The
  phone shrinks it to 400×400 before sending, so uploads are fast.
- A "Check it's you" link lets them confirm the username before joining.
- Every username anywhere in the app is a tap-through link to
  `instagram.com/<username>`, so guests can follow each other.
- The **People** tab lists everyone at the party with their photo, handle,
  songs and hearts received. Guests can search by name or by song.
- We **never ask for Instagram passwords** and never log into Instagram.
- **Sharing**: the replay page has a phone share sheet (which includes Instagram
  DMs if the app is installed), copy link, text message, WhatsApp, and a
  ready-made **Story image** (1080×1920) guests save and post, adding the link
  with Instagram's own link sticker.

## Trust note

Because usernames aren't verified, someone could type a handle that isn't
theirs. Mitigations: one handle per event, the host can remove/reset any guest
from the control room, and the profile link lets everyone see the real account.
