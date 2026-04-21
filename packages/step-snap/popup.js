document.addEventListener('DOMContentLoaded', async () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const historyBtn = document.getElementById('historyBtn');
    const statusText = document.getElementById('statusText');
    const thumbnail = document.getElementById('thumbnail');

    let currentTabId = null;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        currentTabId = tab.id;
        chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: tab.id }, updateUI);
    }

    function updateUI(state) {
        if (!state) return;
        if (state.recording) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';

            if (state.paused) {
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'block';
                statusText.innerText = `Paused. Steps: ${state.steps.length}`;
            } else {
                pauseBtn.style.display = 'block';
                resumeBtn.style.display = 'none';
                statusText.innerText = `Recording... Steps: ${state.steps.length}`;
            }

            if (state.steps.length > 0) {
                const lastStep = state.steps[state.steps.length - 1];
                thumbnail.src = lastStep.screenshotAnnotated || lastStep.screenshotRaw;
                thumbnail.style.display = 'block';
            }
        } else {
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'none';
            statusText.innerText = 'Ready to record';
            thumbnail.style.display = 'none';
        }
    }

    startBtn.onclick = () => {
        chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId: currentTabId }, () => {
            chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: currentTabId }, updateUI);
            window.close(); // optional: close popup on start
        });
    };

    stopBtn.onclick = () => {
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING', tabId: currentTabId }, () => {
            chrome.runtime.sendMessage({ type: 'SAVE_GUIDE', tabId: currentTabId }, () => {
                window.close();
            });
        });
    };

    pauseBtn.onclick = () => {
        chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING', tabId: currentTabId }, () => {
             chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: currentTabId }, updateUI);
        });
    };

    resumeBtn.onclick = () => {
        chrome.runtime.sendMessage({ type: 'RESUME_RECORDING', tabId: currentTabId }, () => {
             chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: currentTabId }, updateUI);
        });
    };

    historyBtn.onclick = () => {
        chrome.tabs.create({ url: 'history.html' });
    };
});
