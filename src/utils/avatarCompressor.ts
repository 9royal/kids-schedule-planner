/**
 * Compresses and crops an uploaded image file to a 128x128 circular 1:1 WebP/JPEG data URL
 * Guaranteed to be < 15KB to prevent bandwidth bottleneck across 40 iPads in a classroom.
 */
export async function compressAvatarImage(file: File): Promise<{ dataUrl: string; byteSize: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('載入圖片格式失敗'));
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('瀏覽器不支援 Canvas'));
          return;
        }

        // Fill warm background before circular clip
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Center crop 1:1 square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        ctx.restore();

        // Try WebP first, fallback to JPEG, decreasing quality until < 15KB
        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        while (dataUrl.length * 0.75 > 14500 && quality > 0.3) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const byteSize = Math.round((dataUrl.length * 3) / 4);
        resolve({ dataUrl, byteSize });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generates a cute default SVG avatar data URL based on seat number
 */
export function generateDefaultAvatar(seatNumber: number, name?: string): string {
  const colors = [
    '#F87171', '#FB923C', '#FBBF24', '#34D399',
    '#38BDF8', '#818CF8', '#C084FC', '#F472B6',
  ];
  const bg = colors[(seatNumber - 1) % colors.length];
  const label = name ? Array.from(name)[0] : String(seatNumber);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <circle cx="64" cy="64" r="64" fill="${bg}"/>
    <circle cx="64" cy="52" r="24" fill="#FFFBEB" opacity="0.25"/>
    <text x="64" y="78" font-family="sans-serif" font-size="48" font-weight="900" fill="#FFFFFF" text-anchor="middle">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
