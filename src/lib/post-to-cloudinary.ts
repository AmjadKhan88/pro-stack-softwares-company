/** Sends the file straight to Cloudinary (never through our server), reporting progress as a percentage. */
export function postToCloudinary(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detail = "";
      try {
        detail = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? "";
      } catch {
        /* keep the generic message */
      }
      reject(
        new Error(
          detail
            ? `The storage service refused the file: ${detail}`
            : "The storage service refused the file.",
        ),
      );
    };
    xhr.onerror = () =>
      reject(
        new Error("The upload couldn't reach the storage service. Check your connection and try again."),
      );
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append("file", file);
    xhr.send(body);
  });
}
