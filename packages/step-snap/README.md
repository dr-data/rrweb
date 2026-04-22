# StepSnap

StepSnap is a Chrome Extension that automatically captures your browser interactions as step-by-step annotated screenshots that can be exported as a how-to guide (HTML, Markdown, or JSON). It serves as a workflow documentation and process capture tool, utilizing `rrweb` to additionally capture DOM events and full session replays.

## Features
- **Auto-Capture & Annotation:** Clicks are tracked via a content script and trigger a visible tab screenshot. Screenshots are automatically annotated with numbered red circles at the point of interaction.
- **rrweb Integration:** Captures background DOM events and mutations during your session for a comprehensive workflow trail.
- **Guide Editor:** Allows you to edit descriptions, add text-only steps, reorder steps via drag-and-drop, and delete mistakes.
- **Canvas Annotator:** Open individual step screenshots in a dedicated editor to add arrows, boxes, text, or blur sensitive data, complete with a full undo/redo stack.
- **Exporting:** Download your guides entirely offline as single-file HTML, Markdown, or raw JSON data.

## Installation

This extension is built for Chrome (Manifest V3).

1. Go to `chrome://extensions/` in your Chrome browser.
2. Ensure **Developer mode** is enabled (toggle in the top right corner).
3. Click **Load unpacked**.
4. Select the `packages/step-snap` folder from this repository.
5. Pin the StepSnap extension icon to your toolbar for easy access!

## How to Use

1. Click on the StepSnap icon in your browser toolbar to open the popup.
2. Click **Start Recording**. The extension will now listen to your clicks on the active page.
3. Perform the actions you want to document (e.g., clicking buttons, filling forms).
    - *Note: Check the browser console if you have the `DEBUG` flag set to see logs of what is being captured.*
4. When finished, open the popup again and click **Stop & Save**.
5. The Guide Editor will automatically open in a new tab, allowing you to review your steps, edit descriptions, or modify image annotations.
6. Return to the **History** dashboard at any time via the extension popup to view, edit, or export your saved guides.

## Debugging

If you need to trace how the steps are recorded, you can view the console logs.
- A `DEBUG = true;` flag is present in both `background.js` and `content.js`.
- By default, these print out when a recording session starts and when a click interaction is captured.
- You can turn them off by setting `DEBUG = false;` in the respective files.

## Running Tests

An automated end-to-end (E2E) Puppeteer test is provided to verify the core recording pipeline.

### Prerequisites
Make sure you are in the `packages/step-snap` directory and dependencies are installed:
```bash
yarn install
```

### Running the E2E Test
Execute the test command:
```bash
yarn test:e2e
```
*Note: This script launches Chrome using Puppeteer, navigates to a local `demo.html` page, records dummy steps, and verifies that the editor properly registers them.*
