import { saveGuide } from './storage.js';
import { annotateScreenshot } from './annotate.js';

const recordingState = new Map(); // tabId -> { steps, recording, paused, rrwebEvents }

function createScreenshotOffscreen(base64Raw, x, y, stepNumber) {
    return annotateScreenshot(base64Raw, { x, y, stepNumber });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender?.tab?.id || message.tabId;

  if (message.type === 'START_RECORDING') {
    recordingState.set(tabId, { steps: [], recording: true, paused: false, rrwebEvents: [] });
    // Inject content script if not already injected
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['rrweb.min.js', 'content.js']
    }).then(() => {
      chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
    });
    sendResponse({ success: true });
    return;
  }

  if (message.type === 'STOP_RECORDING') {
    const state = recordingState.get(tabId);
    if (state) {
      state.recording = false;
      chrome.tabs.sendMessage(tabId, { type: 'STOP_RECORDING' });
      // Don't auto-save here, wait for UI to call SAVE_GUIDE or save here if preferred
    }
    sendResponse({ success: true });
    return;
  }

  if (message.type === 'PAUSE_RECORDING') {
    const state = recordingState.get(tabId);
    if (state) state.paused = true;
    chrome.tabs.sendMessage(tabId, { type: 'PAUSE_RECORDING' });
    sendResponse({ success: true });
    return;
  }

  if (message.type === 'RESUME_RECORDING') {
    const state = recordingState.get(tabId);
    if (state) state.paused = false;
    chrome.tabs.sendMessage(tabId, { type: 'RESUME_RECORDING' });
    sendResponse({ success: true });
    return;
  }

  if (message.type === 'GET_STATUS') {
     const state = recordingState.get(message.tabId);
     sendResponse(state || { recording: false, paused: false, steps: [] });
     return;
  }

  if (message.type === 'ADD_STEP') {
    const state = recordingState.get(tabId);
    if (!state || state.paused) return;

    const stepNumber = state.steps.length + 1;
    const { x, y, target, pageTitle, pageURL } = message;

    // Wait slightly to let click ripple resolve
    setTimeout(async () => {
      try {
        const screenshotRaw = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });

        // Annotate in background. We use our annotateScreenshot which leverages OffscreenCanvas if available
        // Note: For Manifest V3 background workers, standard DOM Canvas isn't available.
        // We'll use OffscreenCanvas. Let's patch annotate.js or use OffscreenCanvas directly here.
        // Let's implement it here directly using OffscreenCanvas:

        let screenshotAnnotated = screenshotRaw; // fallback
        try {
            const response = await fetch(screenshotRaw);
            const blob = await response.blob();
            const bitmap = await createImageBitmap(blob);

            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);

            ctx.beginPath();
            ctx.arc(x, y, 18, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'red';
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stepNumber.toString(), x, y);

            const annotatedBlob = await canvas.convertToBlob({ type: 'image/png' });

            // convert blob to base64
            const reader = new FileReader();
            screenshotAnnotated = await new Promise(resolve => {
               reader.onloadend = () => resolve(reader.result);
               reader.readAsDataURL(annotatedBlob);
            });
        } catch(e) {
            console.error('Error annotating with OffscreenCanvas', e);
        }

        const step = {
          id: crypto.randomUUID(),
          number: stepNumber,
          description: `Clicked '${target}'`,
          pageTitle,
          pageURL,
          timestamp: Date.now(),
          screenshotRaw,
          screenshotAnnotated,
          annotations: []
        };
        state.steps.push(step);
      } catch (err) {
        console.error("Failed to capture tab", err);
      }
    }, 100);
    sendResponse({ success: true });
    return;
  }

  if (message.type === 'RRWEB_EVENTS_BATCH') {
    const state = recordingState.get(tabId);
    if (state && !state.paused) {
        state.rrwebEvents.push(...message.events);
    }
  }

  if (message.type === 'SAVE_GUIDE') {
     const state = recordingState.get(message.tabId);
     if (!state || state.steps.length === 0) {
        sendResponse({ success: false, error: 'No steps recorded' });
        return;
     }
     const guide = {
        id: crypto.randomUUID(),
        name: `Guide - ${new Date().toLocaleString()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        steps: state.steps,
        rrwebEvents: state.rrwebEvents,
        coverThumbnail: state.steps[0].screenshotAnnotated
     };
     saveGuide(guide).then(() => {
        recordingState.delete(message.tabId);
        chrome.tabs.create({ url: `editor.html?guideId=${guide.id}` });
        sendResponse({ success: true, id: guide.id });
     });
     return true; // async
  }
});
