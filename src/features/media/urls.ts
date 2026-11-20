import type { PublicImage } from "@/features/content/types";

/** True only for an https Cloudinary delivery URL (optionally of one specific cloud). */
export function isCloudinaryImageUrl(url: unknown, cloudName?: string): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return false;
    if (parsed.search || parsed.hash || parsed.username || parsed.password) return false;
    const parts = parsed.pathname.split("/"); // ["", cloud, "image", "upload", ...]
    if (parts[2] !== "image" || parts[3] !== "upload") return false;
    return cloudName ? parts[1] === cloudName : true;
  } catch {
    return false;
  }
}

/** Inserts a transformation after /image/upload/. Anything that isn't a Cloudinary image URL is returned as is. */
export function withTransformation(secureUrl: string, transformation: string): string {
  if (!isCloudinaryImageUrl(secureUrl) || !/^[a-z0-9_,.:]+$/i.test(transformation)) return secureUrl;
  return secureUrl.replace("/image/upload/", `/image/upload/${transformation}/`);
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const OG_TRANSFORMATION = `c_fill,g_auto,w_${OG_WIDTH},h_${OG_HEIGHT},f_jpg,q_auto`;

/** The social-sharing version of an image: 1200x630, cropped around the interesting part. */
export function ogImageUrl(secureUrl: string): string {
  return withTransformation(secureUrl, OG_TRANSFORMATION);
}

/** Page metadata for a share image, or undefined when there is no image. */
export function ogImageMeta(image: PublicImage | undefined) {
  if (!image) return undefined;
  return [{ url: ogImageUrl(image.url), width: OG_WIDTH, height: OG_HEIGHT, alt: image.alt }];
}
