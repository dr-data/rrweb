import { getGuides, deleteGuide, updateGuide } from './storage.js';
import { exportToHTML, exportToMarkdown, exportToJSON } from './exportGuide.js';

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('guidesGrid');
    const emptyState = document.getElementById('emptyState');
    const storageFill = document.getElementById('storageFill');

    async function loadGuides() {
        const guides = await getGuides();

        if (chrome.storage && chrome.storage.local && chrome.storage.local.getBytesInUse) {
            const bytes = await chrome.storage.local.getBytesInUse();
            const percent = Math.min(100, (bytes / (5 * 1024 * 1024)) * 100);
            storageFill.style.width = `${percent}%`;
            storageFill.style.background = percent > 80 ? '#f44336' : '#4caf50';
        }

        grid.innerHTML = '';
        if (guides.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        // Sort newest first
        guides.sort((a, b) => b.createdAt - a.createdAt);

        guides.forEach(guide => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${guide.coverThumbnail || ''}" alt="Cover" onerror="this.style.display='none'">
                <div class="card-body">
                    <div class="card-title" contenteditable="true" spellcheck="false">${escapeHTML(guide.name)}</div>
                    <div class="card-meta">
                        ${guide.steps.length} steps • ${new Date(guide.createdAt).toLocaleString()}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-edit">Edit</button>
                    <select class="export-dropdown">
                        <option value="">Export...</option>
                        <option value="html">HTML</option>
                        <option value="md">Markdown</option>
                        <option value="json">JSON</option>
                    </select>
                    <button class="btn-delete">Delete</button>
                </div>
            `;

            const titleEl = card.querySelector('.card-title');
            titleEl.addEventListener('blur', () => {
                if (titleEl.innerText.trim() !== guide.name) {
                    updateGuide(guide.id, { name: titleEl.innerText.trim() });
                }
            });

            card.querySelector('.btn-edit').onclick = () => {
                window.location.href = `editor.html?guideId=${guide.id}`;
            };

            card.querySelector('.btn-delete').onclick = async () => {
                if (confirm('Are you sure you want to delete this guide?')) {
                    await deleteGuide(guide.id);
                    loadGuides();
                }
            };

            card.querySelector('.export-dropdown').onchange = (e) => {
                const format = e.target.value;
                if (!format) return;
                let blob;
                let filename = guide.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

                if (format === 'html') { blob = exportToHTML(guide); filename += '.html'; }
                if (format === 'md') { blob = exportToMarkdown(guide); filename += '.md'; }
                if (format === 'json') { blob = exportToJSON(guide); filename += '.json'; }

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                e.target.value = '';
            };

            grid.appendChild(card);
        });
    }

    function escapeHTML(str) {
      if (!str) return '';
      return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    loadGuides();
});
