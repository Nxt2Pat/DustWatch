/**
 * Utility to convert and compress user-selected files into Data URIs (data:image/jpeg;base64,...).
 * Ensures uploaded images render 100% reliably on Vercel, offline, or remote environments
 * without depending on localhost static server paths.
 */

export async function convertFileToCompressedDataUrl(
  file: File,
  maxDim = 1920,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve((e.target?.result as string) || '');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve((e.target?.result as string) || '');
      };
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function compressMultipleFiles(files: FileList | File[]): Promise<string[]> {
  const fileArray = Array.from(files);
  const dataUrls = await Promise.all(fileArray.map((f) => convertFileToCompressedDataUrl(f)));
  return dataUrls.filter((url) => url && url.length > 0);
}
