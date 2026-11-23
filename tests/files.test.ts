import { describe, expect, it } from "vitest";
import {
  FILE_ID_FIELDS,
  fileIdSchema,
  fileVisibilitySchema,
  finalizeFileSchema,
  pickFields,
  requestFileUploadSchema,
} from "@/features/files/schema";
import {
  MAX_FILE_BYTES,
  clientMayDownload,
  contentDisposition,
  contentTypeForFormat,
  downloadFilename,
  formatForUpload,
  isOwnFilePublicId,
  staffMayDownload,
  validateFileRequest,
  verifyStoredFile,
  type ClientFileFacts,
  type StoredFileInfo,
} from "@/features/files/rules";
import { newFilePublicId } from "@/features/files/ids";

const ID = "64b7f1c2a3d4e5f60718293a";
const PUBLIC_ID = "psc/files/0123456789abcdef01234567";

describe("what files may be uploaded", () => {
  const ok = { filename: "Report.PDF", mimeType: "application/pdf", size: 1_000_000 };

  it("accepts PDF, PNG, JPEG and WebP", () => {
    expect(validateFileRequest(ok)).toBeNull();
    expect(validateFileRequest({ filename: "a.png", mimeType: "image/png", size: 10 })).toBeNull();
    expect(validateFileRequest({ filename: "a.jpg", mimeType: "image/jpeg", size: 10 })).toBeNull();
    expect(validateFileRequest({ filename: "a.jpeg", mimeType: "image/jpeg", size: 10 })).toBeNull();
    expect(
      validateFileRequest({ filename: "a.webp", mimeType: "image/webp", size: MAX_FILE_BYTES }),
    ).toBeNull();
    expect(formatForUpload({ filename: "a.jpeg", mimeType: "image/jpeg" })).toBe("jpg");
  });

  it("refuses everything else, including documents that can carry macros or programs", () => {
    for (const mimeType of [
      "application/zip",
      "application/x-msdownload",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/svg+xml",
      "image/gif",
      "text/html",
      "application/octet-stream",
      "",
    ]) {
      expect(validateFileRequest({ ...ok, mimeType }), mimeType).toBe(
        "Choose a PDF, PNG, JPEG or WebP file.",
      );
    }
  });

  it("requires the file name to agree with the type", () => {
    for (const filename of ["a.png", "a", "a.pdf.exe", "a.zip", ".pdf", "a.html", "a.constructor"]) {
      expect(validateFileRequest({ ...ok, filename }), filename).toMatch(/file name/);
      expect(formatForUpload({ filename, mimeType: "application/pdf" })).toBeNull();
    }
  });

  it("refuses empty and oversized files", () => {
    expect(validateFileRequest({ ...ok, size: 0 })).toMatch(/empty/);
    expect(validateFileRequest({ ...ok, size: Number.NaN })).toMatch(/empty/);
    expect(validateFileRequest({ ...ok, size: MAX_FILE_BYTES + 1 })).toMatch(/10 MB/);
  });

  it("maps formats to content types and rejects unknown ones", () => {
    expect(contentTypeForFormat("pdf")).toBe("application/pdf");
    expect(contentTypeForFormat("jpg")).toBe("image/jpeg");
    expect(contentTypeForFormat("exe")).toBeNull();
    expect(contentTypeForFormat("constructor")).toBeNull();
  });
});

describe("our own file names", () => {
  it("creates unguessable names inside the files folder, and recognises only those", () => {
    const ids = new Set(Array.from({ length: 200 }, newFilePublicId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isOwnFilePublicId(id)).toBe(true);
    for (const bad of [
      "",
      "psc/site/0123456789abcdef01234567",
      "psc/files/short",
      "psc/files/../x",
      "psc/files/0123456789ABCDEF01234567",
      5,
      null,
    ]) {
      expect(isOwnFilePublicId(bad), String(bad)).toBe(false);
    }
  });
});

describe("checking what Cloudinary really stored", () => {
  const info: StoredFileInfo = {
    public_id: PUBLIC_ID,
    resource_type: "image",
    type: "authenticated",
    format: "pdf",
    bytes: 500_000,
  };
  const verify = (
    overrides: Partial<StoredFileInfo> = {},
    expectedFormat: "pdf" | "png" | "jpg" | "webp" = "pdf",
  ) => verifyStoredFile({ info: { ...info, ...overrides }, expectedPublicId: PUBLIC_ID, expectedFormat });

  it("accepts a private file that matches the request", () => {
    expect(verify()).toEqual({ ok: true, format: "pdf", bytes: 500_000 });
  });

  it("refuses a file that is publicly reachable", () => {
    expect(verify({ type: "upload" })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/privately/),
    });
    expect(verify({ type: "private" })).toMatchObject({ ok: false });
  });

  it("refuses the wrong file, kind, format, size or an empty file", () => {
    expect(verify({ public_id: "psc/files/ffffffffffffffffffffffff" })).toMatchObject({ ok: false });
    expect(verify({ resource_type: "raw" })).toMatchObject({ ok: false });
    expect(verify({ format: "zip" })).toMatchObject({ ok: false });
    expect(verify({ format: "png" })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/doesn't match/),
    });
    expect(verify({}, "png")).toMatchObject({ ok: false });
    expect(verify({ bytes: MAX_FILE_BYTES + 1 })).toMatchObject({ ok: false });
    expect(verify({ bytes: 0 })).toMatchObject({ ok: false });
  });
});

describe("download names and headers", () => {
  it("uses the original name with the true extension", () => {
    expect(downloadFilename("Final Report.pdf", "pdf")).toBe("Final Report.pdf");
    expect(downloadFilename("photo.jpeg", "jpg")).toBe("photo.jpg");
    expect(downloadFilename("no-extension", "png")).toBe("no-extension.png");
    expect(downloadFilename("", "pdf")).toBe("image.pdf");
    expect(downloadFilename("a".repeat(300), "pdf")).toHaveLength(104);
    expect(downloadFilename("x", "../../etc")).toBe("x.bin");
  });

  it("cannot be broken out of with quotes or line breaks", () => {
    const header = contentDisposition('evil"; filename="x.exe\r\nSet-Cookie: a=b.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.startsWith("attachment; filename=")).toBe(true);
    expect(header.split('filename="')[1].split('"')[0]).not.toContain('"');
    expect(header).toContain("filename*=UTF-8''");
  });

  it("handles other alphabets", () => {
    const header = contentDisposition("رپورٹ.pdf");
    expect(header).toMatch(/^attachment; filename="[\x20-\x7e]*"; filename\*=UTF-8''%/);
    expect(contentDisposition("it's (1).pdf")).toContain("%27");
  });
});

describe("which clients may download a file", () => {
  const base: ClientFileFacts = {
    clientOrganizationId: "org-a",
    fileOrganizationId: "org-a",
    fileStatus: "active",
    fileClientVisible: true,
    hasDeliverable: false,
    deliverableClientVisible: false,
  };

  it("allows their own organization's active, visible file", () => {
    expect(clientMayDownload(base)).toBe(true);
    expect(clientMayDownload({ ...base, hasDeliverable: true, deliverableClientVisible: true })).toBe(true);
  });

  it("refuses another organization, a client with no organization, hidden or archived files", () => {
    expect(clientMayDownload({ ...base, fileOrganizationId: "org-b" })).toBe(false);
    expect(clientMayDownload({ ...base, clientOrganizationId: null })).toBe(false);
    expect(clientMayDownload({ ...base, fileClientVisible: false })).toBe(false);
    expect(clientMayDownload({ ...base, fileStatus: "archived" })).toBe(false);
    expect(clientMayDownload({ ...base, fileStatus: "deleted" })).toBe(false);
  });

  it("refuses a file attached to a deliverable the client can't see", () => {
    expect(clientMayDownload({ ...base, hasDeliverable: true, deliverableClientVisible: false })).toBe(false);
  });

  it("never lets an empty or look-alike organization id match", () => {
    expect(clientMayDownload({ ...base, clientOrganizationId: "", fileOrganizationId: "" })).toBe(
      true === false,
    );
    expect(clientMayDownload({ ...base, clientOrganizationId: "org-a ", fileOrganizationId: "org-a" })).toBe(
      false,
    );
  });
});

describe("which staff may download a file", () => {
  it("lets roles that see every project download, and developers only on their own projects", () => {
    for (const role of ["support", "project_manager", "admin", "owner"]) {
      expect(staffMayDownload({ role, isMember: false }), role).toBe(true);
    }
    expect(staffMayDownload({ role: "developer", isMember: true })).toBe(true);
    expect(staffMayDownload({ role: "developer", isMember: false })).toBe(false);
  });

  it("refuses roles with no project access, even as a member", () => {
    for (const role of ["client", "content_manager", undefined, "root"]) {
      expect(staffMayDownload({ role, isMember: true }), String(role)).toBe(false);
    }
  });
});

describe("file input", () => {
  it("validates upload requests strictly", () => {
    const good = {
      projectId: ID,
      filename: "a.pdf",
      mimeType: "application/pdf",
      size: 100,
      clientVisible: false,
    };
    expect(requestFileUploadSchema.safeParse(good).success).toBe(true);
    expect(requestFileUploadSchema.safeParse({ ...good, deliverableId: ID }).success).toBe(true);
    expect(requestFileUploadSchema.safeParse({ ...good, deliverableId: "" }).success).toBe(false);
    expect(requestFileUploadSchema.safeParse({ ...good, projectId: "nope" }).success).toBe(false);
    expect(requestFileUploadSchema.safeParse({ ...good, organizationId: "x" }).success).toBe(false);
    expect(requestFileUploadSchema.safeParse({ ...good, clientVisible: "yes" }).success).toBe(false);
  });

  it("only lets people finish uploads that look like ours", () => {
    expect(finalizeFileSchema.safeParse({ publicId: PUBLIC_ID }).success).toBe(true);
    expect(finalizeFileSchema.safeParse({ publicId: "psc/site/0123456789abcdef01234567" }).success).toBe(
      false,
    );
    expect(finalizeFileSchema.safeParse({ publicId: PUBLIC_ID, userId: "someone" }).success).toBe(false);
  });

  it("validates ids and visibility, ignoring forged form entries", () => {
    expect(fileIdSchema.safeParse({ fileId: ID }).success).toBe(true);
    expect(fileIdSchema.safeParse({ fileId: "nope" }).success).toBe(false);
    expect(fileVisibilitySchema.parse({ fileId: ID, visible: "true" }).visible).toBe(true);
    expect(fileVisibilitySchema.parse({ fileId: ID, visible: "false" }).visible).toBe(false);
    expect(fileVisibilitySchema.safeParse({ fileId: ID, visible: "yes" }).success).toBe(false);
    const fd = new FormData();
    fd.set("fileId", ID);
    fd.set("organizationId", "someone-elses");
    fd.set("$ACTION_ID_x", "1");
    expect(Object.keys(pickFields(fd, FILE_ID_FIELDS))).toEqual(["fileId"]);
  });
});
