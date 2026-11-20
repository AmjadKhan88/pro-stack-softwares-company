import { describe, expect, it } from "vitest";
import { toPublicCaseStudy, toPublicService, type PublishedAsset } from "@/features/cms/mapping";
import { parseContentForm } from "@/features/cms/schema";
import {
  ALT_UPDATE_FIELDS,
  altTextSchema,
  altUpdateSchema,
  assetIdSchema,
  finalizeSchema,
  parseMediaFilters,
  pickFields,
  pickerSchema,
  requestUploadSchema,
} from "@/features/media/schema";
import {
  MAX_UPLOAD_BYTES,
  extensionOf,
  isOwnPublicId,
  sanitizeFilename,
  validateUploadRequest,
  verifyUploadedAsset,
  type UploadedAssetInfo,
} from "@/features/media/rules";
import { newPublicId, signParams } from "@/features/media/signing";
import { isCloudinaryImageUrl, ogImageMeta, ogImageUrl, withTransformation } from "@/features/media/urls";
import { AUDIT_LABELS } from "@/features/audit/labels";
import { AUDIT_ACTIONS } from "@/features/audit/types";

const ID = "64b7f1c2a3d4e5f60718293a";
const CLOUD = "demo-cloud";
const PUBLIC_ID = "psc/site/0123456789abcdef01234567";
const URL = `https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/${PUBLIC_ID}.jpg`;

describe("Cloudinary signatures", () => {
  // These are the worked examples from Cloudinary's own documentation (SHA-1, secret "abcd").
  it("matches Cloudinary's published example with only a timestamp", () => {
    expect(signParams({ timestamp: "1315060510" }, "abcd", "sha1")).toBe(
      "a21ad0f63beb4de2e5575204b79ab90bffb02c10",
    );
  });

  it("matches Cloudinary's published example with several parameters (sorted by name)", () => {
    const signature = signParams(
      { timestamp: "1315060510", public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" },
      "abcd",
      "sha1",
    );
    expect(signature).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("does not depend on the order the parameters are given in, and SHA-256 gives 64 hex characters", () => {
    const a = signParams({ timestamp: "1", public_id: "x", allowed_formats: "jpg" }, "secret");
    const b = signParams({ allowed_formats: "jpg", public_id: "x", timestamp: "1" }, "secret");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(signParams({ timestamp: "1" }, "other-secret")).not.toBe(signParams({ timestamp: "1" }, "secret"));
  });

  it("creates unguessable names inside our folder, and recognises only those as ours", () => {
    const ids = new Set(Array.from({ length: 200 }, newPublicId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isOwnPublicId(id)).toBe(true);
    for (const bad of [
      "",
      "psc/site/short",
      "other/folder/0123456789abcdef01234567",
      "psc/site/../x",
      "psc/site/0123456789ABCDEF01234567",
      5,
      null,
    ]) {
      expect(isOwnPublicId(bad), String(bad)).toBe(false);
    }
  });
});

describe("what may be uploaded", () => {
  const ok = { filename: "photo.JPG", mimeType: "image/jpeg", size: 1_000_000 };

  it("accepts JPEG, PNG and WebP of a sensible size", () => {
    expect(validateUploadRequest(ok)).toBeNull();
    expect(validateUploadRequest({ filename: "a.png", mimeType: "image/png", size: 10 })).toBeNull();
    expect(
      validateUploadRequest({ filename: "a.webp", mimeType: "image/webp", size: MAX_UPLOAD_BYTES }),
    ).toBeNull();
    expect(validateUploadRequest({ filename: "a.jpeg", mimeType: "image/jpeg", size: 10 })).toBeNull();
  });

  it("rejects other types, including SVG (it can carry scripts) and GIF", () => {
    for (const mimeType of ["image/svg+xml", "image/gif", "text/html", "application/pdf", "", "image/avif"]) {
      expect(validateUploadRequest({ ...ok, mimeType }), mimeType).toBe("Choose a JPEG, PNG or WebP image.");
    }
  });

  it("requires the file name's extension to match the type", () => {
    for (const filename of ["photo.png", "photo", "photo.jpg.exe", "photo.svg", ".jpg", "photo.php"]) {
      expect(validateUploadRequest({ ...ok, filename }), filename).toMatch(/file name/);
    }
  });

  it("rejects empty, oversized and nonsense sizes", () => {
    expect(validateUploadRequest({ ...ok, size: 0 })).toMatch(/empty/);
    expect(validateUploadRequest({ ...ok, size: Number.NaN })).toMatch(/empty/);
    expect(validateUploadRequest({ ...ok, size: MAX_UPLOAD_BYTES + 1 })).toMatch(/up to 5\.0 MB/);
  });

  it("makes file names safe to show", () => {
    expect(sanitizeFilename("C:\\Users\\me\\photo.jpg")).toBe("photo.jpg");
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("a<b>\u0000c.jpg")).toBe("abc.jpg");
    expect(sanitizeFilename("   ")).toBe("image");
    expect(sanitizeFilename("x".repeat(300))).toHaveLength(120);
    expect(extensionOf("a.b.WEBP")).toBe("webp");
    expect(extensionOf("noext")).toBeNull();
  });
});

describe("checking what Cloudinary really stored", () => {
  const info: UploadedAssetInfo = {
    public_id: PUBLIC_ID,
    resource_type: "image",
    type: "upload",
    format: "jpg",
    bytes: 500_000,
    width: 1600,
    height: 900,
    secure_url: URL,
  };
  const verify = (overrides: Partial<UploadedAssetInfo> = {}, cloudName = CLOUD) =>
    verifyUploadedAsset({ info: { ...info, ...overrides }, expectedPublicId: PUBLIC_ID, cloudName });

  it("accepts a good upload and returns Cloudinary's details, not the browser's", () => {
    const result = verify();
    expect(result).toEqual({
      ok: true,
      asset: { publicId: PUBLIC_ID, secureUrl: URL, format: "jpg", bytes: 500_000, width: 1600, height: 900 },
    });
  });

  it("rejects the wrong file, type, format, size or dimensions", () => {
    expect(verify({ public_id: "psc/site/ffffffffffffffffffffffff" })).toMatchObject({ ok: false });
    expect(verify({ resource_type: "raw" })).toMatchObject({ ok: false });
    expect(verify({ type: "private" })).toMatchObject({ ok: false });
    expect(verify({ format: "svg" })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/JPEG, PNG and WebP/),
    });
    expect(verify({ format: "gif" })).toMatchObject({ ok: false });
    expect(verify({ bytes: MAX_UPLOAD_BYTES + 1 })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/up to/),
    });
    expect(verify({ bytes: 0 })).toMatchObject({ ok: false });
    expect(verify({ width: 99 })).toMatchObject({ ok: false });
    expect(verify({ height: 6001 })).toMatchObject({ ok: false });
  });

  it("rejects a file that is not in our cloud or our folder", () => {
    expect(verify({}, "someone-elses-cloud")).toMatchObject({ ok: false });
    expect(
      verify({ secure_url: `https://evil.example.com/${CLOUD}/image/upload/v1/${PUBLIC_ID}.jpg` }),
    ).toMatchObject({ ok: false });
    expect(
      verify({ secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/psc/site/other.jpg` }),
    ).toMatchObject({ ok: false });
  });
});

describe("delivery URLs", () => {
  it("recognises only https Cloudinary image URLs (optionally of one cloud)", () => {
    expect(isCloudinaryImageUrl(URL)).toBe(true);
    expect(isCloudinaryImageUrl(URL, CLOUD)).toBe(true);
    expect(isCloudinaryImageUrl(URL, "other")).toBe(false);
    for (const bad of [
      "http://res.cloudinary.com/demo/image/upload/a.jpg",
      "https://res.cloudinary.com/demo/video/upload/a.mp4",
      "https://evil.com/demo/image/upload/a.jpg",
      "https://res.cloudinary.com.evil.com/demo/image/upload/a.jpg",
      "https://res.cloudinary.com/demo/image/upload/a.jpg?x=1",
      "https://user:pw@res.cloudinary.com/demo/image/upload/a.jpg",
      "javascript:alert(1)",
      "not a url",
      "",
      42,
      null,
    ]) {
      expect(isCloudinaryImageUrl(bad), String(bad)).toBe(false);
    }
  });

  it("inserts a transformation only into genuine Cloudinary URLs", () => {
    expect(withTransformation(URL, "w_100,f_auto")).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/w_100,f_auto/v1700000000/${PUBLIC_ID}.jpg`,
    );
    expect(withTransformation("https://evil.com/image/upload/a.jpg", "w_100")).toBe(
      "https://evil.com/image/upload/a.jpg",
    );
    expect(withTransformation(URL, "w_100/../../x")).toBe(URL);
  });

  it("builds a 1200x630 share image, or nothing when there is no image", () => {
    expect(ogImageUrl(URL)).toContain("/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/");
    expect(ogImageMeta(undefined)).toBeUndefined();
    expect(ogImageMeta({ url: URL, width: 1600, height: 900, alt: "A photo" })).toEqual([
      { url: ogImageUrl(URL), width: 1200, height: 630, alt: "A photo" },
    ]);
  });
});

describe("media input", () => {
  it("needs a real description", () => {
    expect(altTextSchema.safeParse("A team at a whiteboard").success).toBe(true);
    expect(altTextSchema.safeParse("ab").success).toBe(false);
    expect(altTextSchema.safeParse("x".repeat(201)).success).toBe(false);
    expect(altTextSchema.parse("  padded  ")).toBe("padded");
  });

  it("validates upload requests strictly", () => {
    const good = { filename: "a.jpg", mimeType: "image/jpeg", size: 100, altText: "A photo of a team" };
    expect(requestUploadSchema.safeParse(good).success).toBe(true);
    expect(requestUploadSchema.safeParse({ ...good, size: -1 }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ ...good, size: 1.5 }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ ...good, publicId: "psc/site/x" }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ ...good, altText: "" }).success).toBe(false);
  });

  it("only lets people finish uploads that look like ours", () => {
    expect(finalizeSchema.safeParse({ publicId: PUBLIC_ID }).success).toBe(true);
    expect(finalizeSchema.safeParse({ publicId: "other/x" }).success).toBe(false);
    expect(finalizeSchema.safeParse({ publicId: PUBLIC_ID, userId: "someone" }).success).toBe(false);
  });

  it("validates the picker, ids and alt-text updates", () => {
    expect(pickerSchema.safeParse({ q: "logo", page: 2 }).success).toBe(true);
    expect(pickerSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(pickerSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(assetIdSchema.safeParse({ assetId: ID }).success).toBe(true);
    expect(assetIdSchema.safeParse({ assetId: "nope" }).success).toBe(false);
    expect(altUpdateSchema.safeParse({ assetId: ID, altText: "A clear description" }).success).toBe(true);
    const fd = new FormData();
    fd.set("assetId", ID);
    fd.set("altText", "A clear description");
    fd.set("status", "archived");
    expect(Object.keys(pickFields(fd, ALT_UPDATE_FIELDS)).sort()).toEqual(["altText", "assetId"]);
  });

  it("reads library filters defensively", () => {
    expect(parseMediaFilters({ q: " logo ", status: "archived", page: "3" })).toEqual({
      q: "logo",
      status: "archived",
      page: 3,
    });
    expect(parseMediaFilters({ status: "deleted", page: "-2" })).toEqual({
      q: undefined,
      status: undefined,
      page: 1,
    });
  });
});

describe("images in content", () => {
  const FORM = {
    slug: "web-apps",
    title: "Web apps",
    summary: "Custom web applications for you.",
    description: "",
    deliverables: "",
    imageAssetId: ID,
    ogImageAssetId: "",
  };

  it("accepts a library image id, or none, and rejects anything else", () => {
    const withImage = parseContentForm("service", FORM);
    expect(withImage.ok).toBe(true);
    if (withImage.ok) expect((withImage.value.data as { imageAssetId?: string }).imageAssetId).toBe(ID);
    const without = parseContentForm("service", { ...FORM, imageAssetId: "" });
    expect(without.ok).toBe(true);
    if (without.ok) expect((without.value.data as { imageAssetId?: string }).imageAssetId).toBeUndefined();
    expect(parseContentForm("service", { ...FORM, imageAssetId: "https://evil.example/x.png" }).ok).toBe(
      false,
    );
    expect(parseContentForm("service", { ...FORM, ogImageAssetId: "<script>" }).ok).toBe(false);
    const og = parseContentForm("service", { ...FORM, ogImageAssetId: ID });
    if (og.ok) expect(og.value.seo.ogImageAssetId).toBe(ID);
  });

  const assets: Record<string, PublishedAsset> = {
    [ID]: { id: ID, url: URL, width: 1600, height: 900, alt: "A team at work" },
  };
  const item = (extra: object, seo: object = {}) => ({
    slug: "web-apps",
    data: { title: "Web apps", summary: "Custom apps.", ...extra },
    seo,
    assets,
  });

  it("gives public pages the image, with its description", () => {
    expect(toPublicService(item({ imageAssetId: ID }))?.image).toEqual({
      url: URL,
      width: 1600,
      height: 900,
      alt: "A team at work",
    });
    expect(toPublicCaseStudy(item({ imageAssetId: ID }))?.image?.alt).toBe("A team at work");
    expect(toPublicService(item({}, { ogImageAssetId: ID }))?.seo?.ogImage?.url).toBe(URL);
  });

  it("leaves the image out, without failing, when it is missing, archived or has no description", () => {
    expect(toPublicService(item({ imageAssetId: "64b7f1c2a3d4e5f607182900" }))?.image).toBeUndefined();
    expect(toPublicService({ ...item({ imageAssetId: ID }), assets: undefined })?.image).toBeUndefined();
    expect(
      toPublicService({ ...item({ imageAssetId: ID }), assets: { [ID]: { ...assets[ID], alt: "" } } })?.image,
    ).toBeUndefined();
    expect(toPublicService(item({ imageAssetId: 7 }))?.image).toBeUndefined();
    expect(toPublicService(item({ imageAssetId: "__proto__" }))?.image).toBeUndefined();
    expect(toPublicService(item({ imageAssetId: "constructor" }))?.image).toBeUndefined();
  });
});

describe("audit labels", () => {
  it("still cover every audit action", () => {
    expect(Object.keys(AUDIT_LABELS).sort()).toEqual([...AUDIT_ACTIONS].sort());
  });
});
