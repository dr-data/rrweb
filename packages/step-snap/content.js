if (!window.__stepsnap_injected) {
  window.__stepsnap_injected = true;

  const DEBUG = true; // Set to false to disable console logs
  let recording = false;
  let paused = false;
  let stopRrweb = null;
  let rrwebEventBatch = [];
  let flushInterval = null;

  function describeTarget(el) {
    if (!el) return '';
    return el.ariaLabel || el.innerText?.trim().slice(0, 60) || el.placeholder || el.name || el.tagName.toLowerCase();
  }

  function clickHandler(e) {
    if (!recording || paused) return;

    const targetDesc = describeTarget(e.target);
    if (DEBUG) console.log('[StepSnap Content] Captured click on:', targetDesc);
    const x = e.clientX;
    const y = e.clientY;

    // Scale coordinates to physical pixels for high-DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scaledX = Math.round(x * devicePixelRatio);
    const scaledY = Math.round(y * devicePixelRatio);

    chrome.runtime.sendMessage({
      type: 'ADD_STEP',
      x: scaledX,
      y: scaledY,
      target: targetDesc,
      pageTitle: document.title,
      pageURL: window.location.href
    });
  }

  function flushEvents() {
    if (rrwebEventBatch.length > 0) {
      chrome.runtime.sendMessage({ type: 'RRWEB_EVENTS_BATCH', events: rrwebEventBatch });
      rrwebEventBatch = [];
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_RECORDING') {
      recording = true;
      paused = false;
      document.addEventListener('click', clickHandler, true);

      if (window.rrweb && window.rrweb.record) {
         rrwebEventBatch = [];
         flushInterval = setInterval(flushEvents, 1000);
         stopRrweb = window.rrweb.record({
             emit(event) {
                 rrwebEventBatch.push(event);
                 // If batch gets large before interval, flush immediately
                 if (rrwebEventBatch.length >= 100) {
                     flushEvents();
                 }
             }
         });
      }
    } else if (message.type === 'STOP_RECORDING') {
      recording = false;
      document.removeEventListener('click', clickHandler, true);
      if (stopRrweb) {
          stopRrweb();
          stopRrweb = null;
      }
      if (flushInterval) {
          clearInterval(flushInterval);
          flushInterval = null;
      }
      flushEvents(); // Final flush
    } else if (message.type === 'PAUSE_RECORDING') {
      paused = true;
    } else if (message.type === 'RESUME_RECORDING') {
      paused = false;
    }
  });
}
