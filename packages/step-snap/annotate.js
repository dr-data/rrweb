export function annotateScreenshot(base64PNG, { x, y, stepNumber }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Draw red circle
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'red';
      ctx.fill();

      // Draw white step number
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stepNumber.toString(), x, y);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = base64PNG;
  });
}
