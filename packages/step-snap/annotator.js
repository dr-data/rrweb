import { getGuide, updateGuide } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const guideId = urlParams.get('guideId');
    const stepId = urlParams.get('stepId');

    if (!guideId || !stepId) { alert('Missing params'); return window.close(); }

    const guide = await getGuide(guideId);
    if (!guide) { alert('Guide not found'); return window.close(); }
    const step = guide.steps.find(s => s.id === stepId);
    if (!step) { alert('Step not found'); return window.close(); }

    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');

    let img = new Image();
    let currentTool = 'circle';
    let currentColor = 'red';

    let annotations = step.annotations || [];
    let redoStack = [];

    let isDrawing = false;
    let startX = 0, startY = 0;
    let currentTempAnnotation = null;

    let circleCounter = 1;

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        updateCircleCounter();
        redraw();
    };
    img.src = step.screenshotRaw;

    function updateCircleCounter() {
        let maxNumber = 0;
        annotations.forEach(a => {
            if (a.type === 'circle' && typeof a.number === 'number') {
                if (a.number > maxNumber) maxNumber = a.number;
            }
        });
        circleCounter = maxNumber + 1;
    }

    // Tools UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
        };
    });

    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.onclick = () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            currentColor = swatch.dataset.color;
        };
    });

    function redraw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        [...annotations, currentTempAnnotation].filter(Boolean).forEach(drawAnnotation);
    }

    function drawAnnotation(a) {
        ctx.save();
        if (a.type === 'circle') {
            ctx.beginPath();
            ctx.arc(a.x, a.y, 18, 0, 2 * Math.PI);
            ctx.fillStyle = a.color;
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(a.number.toString(), a.x, a.y);
        } else if (a.type === 'arrow') {
            ctx.beginPath();
            ctx.moveTo(a.x1, a.y1);
            ctx.lineTo(a.x2, a.y2);
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 4;
            ctx.stroke();

            // arrowhead
            const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
            ctx.beginPath();
            ctx.moveTo(a.x2, a.y2);
            ctx.lineTo(a.x2 - 15 * Math.cos(angle - Math.PI / 6), a.y2 - 15 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(a.x2 - 15 * Math.cos(angle + Math.PI / 6), a.y2 - 15 * Math.sin(angle + Math.PI / 6));
            ctx.fillStyle = a.color;
            ctx.fill();
        } else if (a.type === 'rect') {
            ctx.fillStyle = a.color;
            ctx.globalAlpha = 0.35;
            ctx.fillRect(Math.min(a.x1, a.x2), Math.min(a.y1, a.y2), Math.abs(a.x2 - a.x1), Math.abs(a.y2 - a.y1));
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(Math.min(a.x1, a.x2), Math.min(a.y1, a.y2), Math.abs(a.x2 - a.x1), Math.abs(a.y2 - a.y1));
        } else if (a.type === 'blur') {
            const x = Math.min(a.x1, a.x2);
            const y = Math.min(a.y1, a.y2);
            const w = Math.abs(a.x2 - a.x1);
            const h = Math.abs(a.y2 - a.y1);
            if (w > 0 && h > 0) {
                // simple blur effect: we use standard canvas filter
                ctx.filter = 'blur(8px)';
                ctx.drawImage(canvas, x, y, w, h, x, y, w, h);
                ctx.filter = 'none';
            }
        } else if (a.type === 'text') {
            ctx.fillStyle = a.color;
            ctx.font = '20px sans-serif';
            ctx.textBaseline = 'top';
            // crude background for text readability
            const width = ctx.measureText(a.text).width;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect(a.x - 5, a.y - 5, width + 10, 30);
            ctx.fillStyle = a.color;
            ctx.fillText(a.text, a.x, a.y);
        }
        ctx.restore();
    }

    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    canvas.onmousedown = (e) => {
        const pos = getMousePos(e);
        startX = pos.x;
        startY = pos.y;

        if (currentTool === 'text') {
            const text = prompt('Enter text:');
            if (text) {
                addAnnotation({ type: 'text', x: startX, y: startY, text, color: currentColor });
            }
            return;
        }

        if (currentTool === 'circle') {
            addAnnotation({ type: 'circle', x: startX, y: startY, number: circleCounter++, color: currentColor });
            return;
        }

        isDrawing = true;
    };

    canvas.onmousemove = (e) => {
        if (!isDrawing) return;
        const pos = getMousePos(e);

        if (currentTool === 'arrow') {
            currentTempAnnotation = { type: 'arrow', x1: startX, y1: startY, x2: pos.x, y2: pos.y, color: currentColor };
        } else if (currentTool === 'rect') {
            currentTempAnnotation = { type: 'rect', x1: startX, y1: startY, x2: pos.x, y2: pos.y, color: currentColor };
        } else if (currentTool === 'blur') {
            currentTempAnnotation = { type: 'blur', x1: startX, y1: startY, x2: pos.x, y2: pos.y };
        }
        redraw();
    };

    canvas.onmouseup = (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        if (currentTempAnnotation) {
            addAnnotation(currentTempAnnotation);
            currentTempAnnotation = null;
        }
    };

    canvas.onmouseout = () => {
        if (isDrawing) {
            isDrawing = false;
            currentTempAnnotation = null;
            redraw();
        }
    }

    function addAnnotation(ann) {
        annotations.push(ann);
        redoStack = [];
        redraw();
    }

    document.getElementById('btnUndo').onclick = () => {
        if (annotations.length > 0) {
            redoStack.push(annotations.pop());
            updateCircleCounter();
            redraw();
        }
    };

    document.getElementById('btnRedo').onclick = () => {
        if (redoStack.length > 0) {
            annotations.push(redoStack.pop());
            updateCircleCounter();
            redraw();
        }
    };

    document.getElementById('btnReset').onclick = () => {
        if (confirm('Clear all annotations?')) {
            annotations = [];
            redoStack = [];
            circleCounter = 1;
            redraw();
        }
    };

    document.getElementById('btnCancel').onclick = () => window.close();

    document.getElementById('btnSave').onclick = async () => {
        step.annotations = annotations;
        step.screenshotAnnotated = canvas.toDataURL('image/png');

        // update cover thumbnail if it's the first step
        if (guide.steps[0].id === step.id) {
            guide.coverThumbnail = step.screenshotAnnotated;
        }

        await updateGuide(guideId, { steps: guide.steps, coverThumbnail: guide.coverThumbnail });
        window.close();
    };
});
