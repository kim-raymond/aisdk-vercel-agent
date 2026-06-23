/**
 * Converts a single File object to a base64 data URL string.
 * e.g. "data:application/pdf;base64,JVBERi0x..."
 */
export function convertFileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Converts an array of File objects to an array of base64 data URL strings.
 * Preserves the order of the input files.
 *
 * Usage:
 *   const [pdfDataUrl] = await convertFilesToDataURLs([file]);
 *   const [img1, img2] = await convertFilesToDataURLs([imageFile1, imageFile2]);
 */
export async function convertFilesToDataURLs(files: File[]): Promise<string[]> {
  return Promise.all(files.map(convertFileToDataURL));
}

/**
 * Extracts only the raw base64 string from a data URL.
 * e.g. "data:application/pdf;base64,JVBERi0x..." → "JVBERi0x..."
 *
 * Useful when an API expects raw base64 instead of a full data URL.
 */
export function extractBase64FromDataURL(dataURL: string): string {
  return dataURL.split(',')[1];
}

/**
 * Extracts the MIME type from a data URL.
 * e.g. "data:application/pdf;base64,..." → "application/pdf"
 */
export function extractMimeTypeFromDataURL(dataURL: string): string {
  return dataURL.split(';')[0].split(':')[1];
}