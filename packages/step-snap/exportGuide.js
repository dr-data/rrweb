export function exportToHTML(guide) {
  let stepsHtml = '';
  guide.steps.forEach(step => {
    stepsHtml += `
      <div class="step">
        <h2>Step ${step.number}</h2>
        ${step.screenshotAnnotated ? `<img src="${step.screenshotAnnotated}" alt="Step ${step.number} screenshot" />` : ''}
        <p>${escapeHTML(step.description)}</p>
        <p class="url"><a href="${step.pageURL}">${escapeHTML(step.pageTitle)}</a></p>
      </div>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHTML(guide.name)}</title>
      <style>
        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .step { margin-bottom: 40px; border-bottom: 1px solid #ccc; padding-bottom: 20px; }
        img { max-width: 100%; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .url { font-size: 0.9em; color: #666; }
      </style>
    </head>
    <body>
      <h1>${escapeHTML(guide.name)}</h1>
      ${stepsHtml}
    </body>
    </html>
  `;
  return new Blob([html], { type: 'text/html' });
}

export function exportToMarkdown(guide) {
  let md = `# ${guide.name}\n\n`;
  guide.steps.forEach(step => {
    md += `## Step ${step.number}\n\n`;
    if (step.screenshotAnnotated) {
      md += `![Step ${step.number}](${step.screenshotAnnotated})\n\n`;
    }
    md += `${step.description}\n\n`;
    if (step.pageURL) {
      md += `> [${step.pageTitle}](${step.pageURL})\n\n`;
    }
  });
  return new Blob([md], { type: 'text/markdown' });
}

export function exportToJSON(guide) {
  return new Blob([JSON.stringify(guide, null, 2)], { type: 'application/json' });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
