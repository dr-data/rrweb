import { getGuide, updateGuide } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const guideId = urlParams.get('guideId');

    if (!guideId) {
        window.location.href = 'history.html';
        return;
    }

    const guide = await getGuide(guideId);
    if (!guide) {
        alert('Guide not found');
        window.location.href = 'history.html';
        return;
    }

    const guideNameEl = document.getElementById('guideName');
    const stepsList = document.getElementById('stepsList');
    const addTextStepBtn = document.getElementById('addTextStepBtn');
    const undoToast = document.getElementById('undoToast');
    const undoBtn = document.getElementById('undoBtn');

    guideNameEl.innerText = guide.name;
    let deletedStepData = null;
    let deleteTimeout = null;

    function renderSteps() {
        stepsList.innerHTML = '';
        guide.steps.forEach((step, index) => {
            const el = document.createElement('div');
            el.className = 'step-card';
            el.dataset.id = step.id;

            el.innerHTML = `
                <div class="step-drag-handle">☰</div>
                <div class="step-number">${step.number}</div>
                <div class="step-content">
                    ${step.screenshotAnnotated || step.screenshotRaw ? `
                    <div class="step-image-container">
                        <img src="${step.screenshotAnnotated || step.screenshotRaw}">
                        <button class="btn-annotate">Edit Annotation</button>
                    </div>` : '<div class="step-image-container" style="display:flex;align-items:center;justify-content:center;background:#eee;color:#999;">Text Only Step</div>'}
                    <div class="step-details">
                        <textarea>${step.description || ''}</textarea>
                        <div class="step-actions">
                            <button class="btn-delete">Delete</button>
                        </div>
                    </div>
                </div>
            `;

            const textarea = el.querySelector('textarea');
            let debounceTimer;
            textarea.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    step.description = textarea.value;
                    save();
                }, 300);
            });

            if (el.querySelector('.btn-annotate')) {
                el.querySelector('.btn-annotate').onclick = () => {
                    window.open(`annotator.html?guideId=${guide.id}&stepId=${step.id}`, '_blank');
                };
            }

            el.querySelector('.btn-delete').onclick = () => {
                deletedStepData = { step: { ...step }, index };
                guide.steps.splice(index, 1);
                reindex();
                renderSteps();
                save();
                showUndoToast();
            };

            stepsList.appendChild(el);
        });
    }

    function reindex() {
        guide.steps.forEach((s, i) => s.number = i + 1);
    }

    function save() {
        updateGuide(guideId, { name: guideNameEl.innerText, steps: guide.steps });
    }

    guideNameEl.addEventListener('blur', save);

    addTextStepBtn.onclick = () => {
        const newStep = {
            id: crypto.randomUUID(),
            number: guide.steps.length + 1,
            description: '',
            timestamp: Date.now()
        };
        guide.steps.push(newStep);
        renderSteps();
        save();

        const lastTextarea = stepsList.lastElementChild.querySelector('textarea');
        if (lastTextarea) {
            lastTextarea.focus();
            window.scrollTo(0, document.body.scrollHeight);
        }
    };

    function showUndoToast() {
        clearTimeout(deleteTimeout);
        undoToast.style.display = 'flex';
        deleteTimeout = setTimeout(() => {
            undoToast.style.display = 'none';
            deletedStepData = null;
        }, 5000);
    }

    undoBtn.onclick = () => {
        if (deletedStepData) {
            guide.steps.splice(deletedStepData.index, 0, deletedStepData.step);
            reindex();
            renderSteps();
            save();
            undoToast.style.display = 'none';
            deletedStepData = null;
            clearTimeout(deleteTimeout);
        }
    };

    renderSteps();

    new Sortable(stepsList, {
        handle: '.step-drag-handle',
        animation: 150,
        onEnd: (evt) => {
            const movedItem = guide.steps.splice(evt.oldIndex, 1)[0];
            guide.steps.splice(evt.newIndex, 0, movedItem);
            reindex();
            renderSteps();
            save();
        }
    });
});
