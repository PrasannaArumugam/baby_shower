# Nivetha & Prasanna's baby shower

A responsive bilingual invitation with an English sage-green theme and a traditional Tamil cream, green, and gold theme. Includes animated twin artwork, a South Indian expecting-couple illustration, an IST-aware countdown, map, calendar download, and Google Sheets RSVP. No build step or npm dependencies.

Use the **EN / தமிழ்** buttons at the top to switch languages without reloading or losing form entries. English is the default. Tamil uses the supplied invitation wording, with matching Tamil navigation, venue details, countdown labels, form fields, and status messages. Both languages send responses to the same private sheet using unchanged attendance/category values.

## Preview and test

Serve this directory over HTTP (JavaScript modules do not work over `file://`):

```sh
python3 -m http.server 8080
```

Open http://localhost:8080. Run the focused tests with Node.js 24:

```sh
node --test
```

## Connect your private Google Sheet

The invitation is usable without a backend, but **responses are not saved until you complete these steps**. It clearly reports this instead of displaying a false success.

1. Create a Google Sheet in the host's account. Keep sharing **Restricted**; do not publish the sheet.
2. Open **Extensions > Apps Script**. Replace the editor contents with [google-apps-script/Code.gs](google-apps-script/Code.gs).
3. In Apps Script **Project Settings > Script properties**, add `SPREADSHEET_ID`. Its value is the part between `/d/` and `/edit` in your spreadsheet URL. This value stays in Apps Script, not in this website.
4. Select and run `setup` in the editor. Authorize access. This creates a `Responses` tab with the expected headers and sets the spreadsheet time zone to Asia/Kolkata.
5. Choose **Deploy > New deployment > Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and authorize. If your organization's account does not allow anonymous web apps, use an account that permits it; guests must not need Google sign-in.
6. Copy the deployed URL ending in `/exec` into `rsvpEndpoint` in [config.js](config.js). Never use the `/dev` URL. Never add Google credentials, tokens, or service account keys to the website.
7. Publish the site, then send a test RSVP from its real HTTPS address. Confirm the success message **and the row in the sheet**, including name, attendance, shared boy/girl category, both suggestions, timestamp, and request ID. Test on a phone without Google sign-in. Test a retry with a temporarily disconnected network as well.

The request uses a CORS-simple `text/plain` body and follows the Apps Script ContentService redirect. Do not change it to `no-cors`: an opaque response cannot confirm that a response was saved. Google account/deployment restrictions or blocked redirects may prevent confirmation; the form retains the entered details and reports an error in that case.

Retries of unchanged details within the same page session use the same request ID, so a response saved before a network interruption is not added twice. Reloading the page or changing the answers makes a new submission. Input lengths and choices are validated on both sides; spreadsheet formula prefixes are escaped. A honeypot deters basic bots, but the public web app is not authenticated or fully spam-proof. Avoid posting the link widely if this is a private event, monitor Apps Script quotas, and disable the deployment after the event. Do not rename the response columns.

To update backend code later, use **Deploy > Manage deployments > Edit > New version > Deploy**.

### View or download responses

Open the private Google Sheet at any time. Use **Data > Create a filter** to filter attendance, and **File > Download > Microsoft Excel (.xlsx)** or **Comma-separated values (.csv)** to export. Only grant sheet access to trusted hosts. The public website has no response viewer or credentials.

## Deploy to GitHub Pages

Target repository: https://github.com/PrasannaArumugam/baby_shower

1. Add these files to the repository's `main` branch (including [.github/workflows/pages.yml](.github/workflows/pages.yml)).
2. In the GitHub repository, open **Settings > Pages > Build and deployment**, and select **GitHub Actions**.
3. Push to `main`, or run **Actions > Deploy invitation to GitHub Pages > Run workflow**.
4. Once the workflow succeeds, visit https://prasannaarumugam.github.io/baby_shower/.

The workflow tests the project and publishes only the public invitation files and displayed artwork. The original reference invitation is not included in the Pages output. If adding artwork later, update the asset copy list in the workflow. All asset paths are relative so the repository subpath works. If your default branch is not `main`, update the workflow branch filter.

## Customize

- Event date/time and deployed RSVP URL: [config.js](config.js).
- Bilingual invitation text, visible dates, form messages, and calendar titles: [translations.mjs](translations.mjs). Keep visible dates consistent with the configured date. [index.html](index.html) contains the English fallback for visitors without JavaScript; keep it consistent when changing English text.
- Map coordinates/link and calendar location: [index.html](index.html) and [app.js](app.js).
- Colors, layouts, and reduced-motion behavior: [styles.css](styles.css).
- Artwork: the supplied [assets/twins.png](assets/twins.png) for English, edited with a transparent background and a "Twice the Love" ribbon, and the supplied [assets/south-indian-couple.png](assets/south-indian-couple.png) for Tamil (an expecting mother in a green sari, her partner, and an illustration of their twins).
- Tamil background: [assets/tamil-canopy.webp](assets/tamil-canopy.webp), [assets/tamil-column-left.webp](assets/tamil-column-left.webp), and [assets/tamil-column-right.webp](assets/tamil-column-right.webp) contain only decorative crops from the supplied [assets/invite.webp](assets/invite.webp). Its names, wording, event details, and portrait are not used; the invitation text remains in [translations.mjs](translations.mjs).

Google Fonts and the embedded Google Map require an internet connection and contact Google when loaded; system font fallbacks and a direct map link are included. Guest answers are sent only on form submission to your configured Apps Script endpoint. Do not include sensitive information in name suggestions.
