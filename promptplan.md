You are a senior full-stack engineer. Build a Chrome Extension called **StepSnap** that clones the core features of Tango.ai using rrweb as the recording engine. The goal: automatically capture a user's browser interactions as step-by-step annotated screenshots that can be exported as a how-to guide.

---

## Core Features to Implement

1. **Click-triggered screenshot capture**
   - Listen to every user click via a content script
   - On each click, call `chrome.tabs.captureVisibleTab()` to grab a screenshot
   - Overlay a visual annotation (red numbered circle) at the click coordinates on the captured image using an offscreen Canvas

2. **rrweb session recording**
   - Inject rrweb into the page via content script
   - Use `rrweb.record()` to capture DOM events, mutations, and interactions in parallel
   - Store events in memory via background service worker Map keyed by tabId (do NOT use localStorage)

3. **Step management**
   - Each click = one "step" with: step number, screenshot (base64 PNG), page title, page URL, click target description (derived from element `aria-label`, `innerText`, `placeholder`, `name`, or tag), and timestamp
   - Auto-generate a human-readable description per step (e.g. "Clicked 'Submit' button on Login Page")

4. **Popup UI**
   - A clean popup (popup.html) with:
     - Start / Stop / Pause recording
     - Step count badge
     - Preview thumbnail of the last captured screenshot
     - Quick-access "History" button that opens history.html

5. **Recording History**
   - Every completed recording session is saved as a named "Guide" entry in `chrome.storage.local`
   - Each Guide has: auto-generated name (e.g. "Guide – Apr 21, 2026 1:09 PM"), creation timestamp, step count, first screenshot as a cover thumbnail, and the full steps array
   - history.html: a full-page dashboard listing all saved guides as cards (cover thumbnail, name, step count, date, Edit / Export / Delete buttons)
   - Guides are sortable by date (newest first default)
   - Guide names are inline-editable (click to rename)
   - Deleting a guide shows a confirmation dialog before removing from storage
   - Storage budget: warn the user (via a banner) if chrome.storage.local usage exceeds 4MB

6. **Step editor (editor.html)**
   - Opened when clicking "Edit" on any guide in history, or auto-opened after stopping a new recording
   - Grid of step cards: annotated screenshot thumbnail, step number badge, editable description textarea
   - Drag-and-drop reorder (use SortableJS from CDN)
   - Delete individual steps with undo (5-second toast undo)
   - "Add text step" button: inserts a step with no screenshot, just a title and body text (for intro/context slides)
   - Auto-save every edit back to chrome.storage.local immediately

7. **Per-step annotation editor**
   - Each step card has an "Edit Annotation" button that opens an annotation canvas modal
   - The modal shows the raw (un-annotated) screenshot on an HTML Canvas
   - Tools available in the annotation toolbar:
     - **Numbered circle** (default): click to place a red numbered dot (auto-increments within the step)
     - **Arrow**: click-drag to draw a directional arrow pointing at a target
     - **Rectangle highlight**: click-drag to draw a semi-transparent yellow rectangle over an area
     - **Text label**: click to place an editable text box on the canvas
     - **Blur/redact**: click-drag to draw a pixelated blur box over sensitive content
     - **Undo / Redo**: full annotation history stack within the modal
   - On "Save Annotation": re-render the canvas to a base64 PNG and update the step's screenshot
   - The raw (original) screenshot is always preserved separately so annotations can be fully reset

8. **Guide export**
   - Export as self-contained HTML: numbered steps, annotated screenshot, description, URL breadcrumb — all CSS/JS inlined, no external CDN
   - Export as Markdown: steps with embedded base64 images
   - Export as JSON: full guide data for re-import
   - "Copy link" is not needed (extension-only tool)

---

## Tech Stack

- **Manifest V3** Chrome Extension
- **rrweb** (bundled as rrweb.min.js) for DOM event capture
- **Vanilla JS** — no React/Vue
- **HTML Canvas** for screenshot capture annotation and the per-step annotation editor
- **chrome.tabs.captureVisibleTab** for screenshots
- **chrome.storage.local** for guide persistence across sessions
- **Background service worker** for in-flight recording state
- **SortableJS** (CDN) for drag-and-drop in editor
- **Blob API** for file exports

---

## File Structure
stepsnap/
├── manifest.json
├── background.js (service worker — recording state, storage ops)
├── content.js (click listener, rrweb init, message relay)
├── popup.html + popup.js (start/stop/pause, step count, last thumbnail, history link)
├── history.html + history.js (guide dashboard — list, rename, delete, open editor)
├── editor.html + editor.js (step grid, reorder, delete+undo, add text step, auto-save)
├── annotator.html + annotator.js (canvas annotation modal opened from editor)
├── annotate.js (shared Canvas utility — draws numbered dot on screenshot)
├── storage.js (shared module — CRUD helpers for guides in chrome.storage.local)
├── rrweb.min.js
└── icons/ (16, 32, 48, 128px icons)


---

## Key Implementation Details

### manifest.json
- Permissions: `["activeTab", "tabs", "scripting", "storage"]`
- `host_permissions`: `["<all_urls>"]`
- `background.service_worker`: `"background.js"`
- Content scripts: inject `content.js` + `rrweb.min.js` on `document_idle`
- All extension pages declared under `web_accessible_resources`

### background.js
- In-memory `Map<tabId, { steps, recording, paused, rrwebEvents }>`
- Message handlers: `START_RECORDING`, `STOP_RECORDING`, `PAUSE_RECORDING`, `RESUME_RECORDING`, `ADD_STEP`, `GET_STEPS`, `SAVE_GUIDE`, `GET_GUIDES`, `UPDATE_GUIDE`, `DELETE_GUIDE`
- `ADD_STEP`: wait 100ms, call `captureVisibleTab()`, pass to `annotate.js` for dot overlay, push to steps
- `SAVE_GUIDE`: assemble Guide object, call storage.js `saveGuide()`, open editor.html for the new guide
- Delegate all chrome.storage.local reads/writes to storage.js

### content.js
- On `START_RECORDING`: attach `document.addEventListener('click', handler, true)`
- On `PAUSE_RECORDING` / `RESUME_RECORDING`: toggle a `paused` flag — skip step capture when paused
- On click (not paused): send `ADD_STEP` message with `{ x, y, target: describeTarget(e.target), pageTitle, pageURL }`
- Initialize rrweb: `rrweb.record({ emit(event) { chrome.runtime.sendMessage({ type: 'RRWEB_EVENT', event }) } })`
- `describeTarget(el)`: `el.ariaLabel || el.innerText?.trim().slice(0,60) || el.placeholder || el.name || el.tagName.toLowerCase()`
- Guard against double injection with a `window.__stepsnap_injected` flag

### storage.js (shared module, importable by both background and pages)
```js
// Guide schema
{
  id: crypto.randomUUID(),
  name: "Guide – Apr 21, 2026 1:09 PM",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  steps: [
    {
      id: crypto.randomUUID(),
      number: 1,
      description: "Clicked 'Submit' button",
      pageTitle: "Login – MyApp",
      pageURL: "https://app.example.com/login",
      timestamp: Date.now(),
      screenshotRaw: "data:image/png;base64,...",   // original, never mutated
      screenshotAnnotated: "data:image/png;base64,...",  // what the user sees/exports
      annotations: []   // annotation layer data for re-editing
    }
  ],
  coverThumbnail: "data:image/png;base64,..."  // = steps.screenshotAnnotated
}
```
- `saveGuide(guide)`, `getGuides()`, `getGuide(id)`, `updateGuide(id, partial)`, `deleteGuide(id)`
- All functions return Promises wrapping `chrome.storage.local` calls
- After every write, check `chrome.storage.local.getBytesInUse()` and send a `STORAGE_WARNING` message if > 4MB

### annotate.js
- `annotateScreenshot(base64PNG, { x, y, stepNumber })` → returns annotated base64 PNG
- Draw image on Canvas, then draw: red filled circle (r=18), white bold step number centered inside
- Export as `canvas.toDataURL('image/png')`

### annotator.html + annotator.js (Per-Step Annotation Editor)
- Opened as a chrome extension page: `annotator.html?guideId=xxx&stepId=yyy`
- Loads the step's `screenshotRaw` onto a Canvas at full resolution
- Replays existing `annotations` array on top so prior edits are visible and editable
- Toolbar with these tools:
  - **Numbered circle**: left-click places a red circle with auto-incrementing number; draggable after placement
  - **Arrow**: mousedown→mouseup draws an SVG-style arrow with arrowhead; color picker (default red)
  - **Rectangle highlight**: mousedown→mouseup draws semi-transparent yellow rect (opacity 0.35)
  - **Text label**: click places an `<input>` overlay; on blur converts to canvas text; font/size/color picker
  - **Blur/redact**: mousedown→mouseup applies `ctx.filter = 'blur(8px)'` pixelation to the selected region; the raw pixels are stored so blur can be undone
  - **Color picker**: small swatch row — red, orange, yellow, green, blue, white, black
  - **Stroke width**: thin / medium / thick toggle for arrows and rects
  - **Undo**: pops the last annotation from the stack and redraws
  - **Redo**: re-applies from the redo stack
  - **Reset**: restores canvas to `screenshotRaw` and clears all annotations
- Annotations are stored as a serializable array of operation objects (not just pixels), enabling full undo/redo and re-editing:
```js
// Example annotation objects
{ type: 'circle', x, y, number, color }
{ type: 'arrow', x1, y1, x2, y2, color, strokeWidth }
{ type: 'rect', x, y, w, h, color, opacity }
{ type: 'text', x, y, text, fontSize, color }
{ type: 'blur', x, y, w, h }
```
- On "Save": render final canvas to PNG, update `step.screenshotAnnotated` and `step.annotations` via `storage.js updateGuide()`, close the modal
- On "Cancel": discard changes, close

### history.html + history.js
- Loads all guides from storage.js on open
- Renders guide cards in a responsive grid (3 cols desktop, 1 col mobile):
  - Cover thumbnail (first step screenshot)
  - Guide name (click to inline-edit, blur to save)
  - Step count badge
  - Relative date ("2 minutes ago", "Yesterday")
  - Action buttons: Edit (→ editor.html), Export dropdown (HTML / Markdown / JSON), Delete
- Empty state: "No guides yet. Start a recording to create your first guide."
- Storage usage bar at the top (used MB / 5MB limit)
- Sort toggle: Newest First / Oldest First

### editor.html + editor.js
- URL param: `editor.html?guideId=xxx`
- Loads guide from storage.js
- Header: editable guide name, step count, "Export" dropdown, "Back to History" link
- Step grid: each card contains:
  - Annotated screenshot thumbnail (click to fullscreen preview)
  - Step number badge (drag handle on the left)
  - Editable `<textarea>` for description (auto-resizes)
  - "Edit Annotation" button → opens annotator.html?guideId=xxx&stepId=yyy in a new tab
  - "Delete" button (with 5-second undo toast)
- "Add text step" FAB: inserts a new step with a placeholder screenshot (gray card with step number) and empty description
- SortableJS drag-and-drop: on sort end, renumber all steps and auto-save
- Every edit (description change, step order, delete) auto-saves via storage.js with 300ms debounce

### Export (shared utility exportGuide.js)
- **HTML**: single file, all screenshots as base64 `<img>`, numbered steps, descriptions, URL breadcrumbs, minimal inline CSS (clean print-ready layout), no external dependencies
- **Markdown**: `## Step N\n\n![Step N](data:image/png;base64,...)\n\nDescription\n\n> URL`
- **JSON**: `JSON.stringify(guide, null, 2)` full guide object for re-import

---

## Quality Requirements
- All persistent state in `chrome.storage.local` via storage.js (never localStorage)
- All in-flight recording state in background service worker memory Map
- Screenshots taken after 100ms delay to let click ripple animations resolve
- Content script guarded against double-injection with `window.__stepsnap_injected`
- Annotation operations stored as serializable objects (not pixels) to allow undo/redo and re-editing
- Raw screenshot always preserved separately from annotated screenshot
- Popup, history, editor, and annotator communicate exclusively via `chrome.runtime.sendMessage` or direct storage.js calls — no shared globals
- Extension must not break host pages — content script uses passive listeners, never mutates page DOM
- All exported files work fully offline (zero external CDN)
- The extension must work on Chrome 120+

---

## Deliverable
Provide the complete, working source code for every file listed in the File Structure above. The extension must be immediately loadable via chrome://extensions → Developer Mode → Load Unpacked. Write full implementations — no placeholder comments, no TODO stubs, no incomplete functions.
