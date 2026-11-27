import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { sanitizeFilename } from "@/features/media/rules";
import { Deliverable } from "@/features/projects/models/deliverable";
import { Project } from "@/features/projects/models/project";
import { clientProjectFilter, isProjectOpen } from "@/features/projects/status";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { logger } from "@/server/logger";
import {
  buildSignedFileUpload,
  destroyStoredFile,
  fetchStoredFile,
} from "@/server/services/cloudinary-files";
import { newFilePublicId } from "./ids";
import { FileUploadIntent } from "./models/file-upload-intent";
import { ProjectFile, type ProjectFileDoc } from "./models/project-file";
import {
  FILE_INTENT_MINUTES,
  clientMayDownload,
  formatForUpload,
  isOwnFilePublicId,
  validateFileRequest,
  verifyStoredFile,
} from "./rules";
import type { FileFinalizeResult, FileUploadRequestResult, FileView } from "./types";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function withSession<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let value!: T;
    await session.withTransaction(async () => {
      value = await work(session);
    });
    return value;
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------- uploading

/** Step 1 of an upload: check the request, then issue a one-use, short-lived ticket plus signed instructions. */
export async function createFileIntent(input: {
  actor: AuditActor;
  projectId: string;
  deliverableId?: string;
  filename: string;
  mimeType: string;
  size: number;
  clientVisible: boolean;
}): Promise<FileUploadRequestResult> {
  const problem = validateFileRequest({
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
  });
  if (problem) return { ok: false, message: problem };
  const format = formatForUpload({ filename: input.filename, mimeType: input.mimeType });
  if (!format) return { ok: false, message: "That file type isn't allowed." };

  await connectToDatabase();
  const project = await Project.findById(input.projectId).lean();
  if (!project) return { ok: false, message: "That project no longer exists." };
  if (!isProjectOpen(project.status))
    return { ok: false, message: "This project is closed, so files can't be added." };
  if (
    input.deliverableId &&
    !(await Deliverable.exists({ _id: input.deliverableId, projectId: input.projectId }))
  ) {
    return { ok: false, message: "That deliverable isn't part of this project." };
  }

  const publicId = newFilePublicId();
  await FileUploadIntent.create({
    publicId,
    userId: input.actor.id,
    projectId: input.projectId,
    deliverableId: input.deliverableId,
    originalFilename: sanitizeFilename(input.filename),
    format,
    clientVisible: input.clientVisible,
    expiresAt: new Date(Date.now() + FILE_INTENT_MINUTES * 60_000),
  });
  return { ok: true, upload: { ...buildSignedFileUpload(publicId), publicId } };
}

/**
 * Step 2, after the browser has uploaded. The server asks Cloudinary what was actually stored and checks it
 * (including that it really is private). Only then is the record created. A file that fails is deleted.
 */
export async function finalizeFileUpload(input: {
  actor: AuditActor;
  publicId: string;
}): Promise<FileFinalizeResult> {
  if (!isOwnFilePublicId(input.publicId)) return { ok: false, message: "That upload isn't valid." };
  await connectToDatabase();

  const existing = await ProjectFile.findOne({ publicId: input.publicId, uploadedBy: input.actor.id }).lean();
  if (existing) return { ok: true, fileId: String(existing._id) }; // finishing twice is harmless

  const intent = await FileUploadIntent.findOne({ publicId: input.publicId, userId: input.actor.id }).lean();
  if (!intent || intent.expiresAt.getTime() < Date.now() || intent.consumedAt) {
    return { ok: false, message: "This upload has expired. Please upload the file again." };
  }
  const expectedFormat = formatForUpload({
    filename: `x.${intent.format}`,
    mimeType: mimeFor(intent.format),
  });
  if (!expectedFormat) return { ok: false, message: "That upload isn't valid." };

  const reject = async (message: string): Promise<FileFinalizeResult> => {
    try {
      await destroyStoredFile(input.publicId);
    } catch (error) {
      logger.error({ err: error, publicId: input.publicId }, "could not delete a rejected private file");
    }
    await FileUploadIntent.deleteOne({ _id: intent._id });
    return { ok: false, message };
  };

  const project = await Project.findById(intent.projectId).lean();
  if (!project || !isProjectOpen(project.status))
    return reject("This project is closed, so files can't be added.");

  const info = await fetchStoredFile(input.publicId);
  if (!info) return { ok: false, message: "We couldn't find the uploaded file. Please try again." };
  const check = verifyStoredFile({ info, expectedPublicId: input.publicId, expectedFormat });
  if (!check.ok) return reject(check.message);

  try {
    return await withSession<FileFinalizeResult>(async (session) => {
      const [created] = await ProjectFile.create(
        [
          {
            projectId: intent.projectId,
            organizationId: project.organizationId,
            deliverableId: intent.deliverableId,
            publicId: input.publicId,
            format: check.format,
            bytes: check.bytes,
            originalFilename: intent.originalFilename,
            status: "active" as const,
            clientVisible: intent.clientVisible,
            uploadedBy: input.actor.id,
            uploadedByEmail: input.actor.email,
          },
        ],
        { session },
      );
      await FileUploadIntent.updateOne(
        { _id: intent._id },
        { $set: { consumedAt: new Date() } },
        { session },
      );
      await recordAudit(
        {
          actor: input.actor,
          action: "file.uploaded",
          target: { type: "file", id: String(created._id) },
          metadata: {
            projectId: intent.projectId,
            filename: intent.originalFilename,
            bytes: check.bytes,
            clientVisible: intent.clientVisible,
          },
        },
        session,
      );
      return { ok: true, fileId: String(created._id) };
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const again = await ProjectFile.findOne({ publicId: input.publicId }).lean();
      if (again) return { ok: true, fileId: String(again._id) };
    }
    throw error;
  }
}

function mimeFor(format: string): string {
  return { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp" }[format] ?? "";
}

// ---------------------------------------------------------------- managing

export type FileResult =
  { ok: true } | { ok: false; reason: "not-found" | "project-closed" | "invalid-state" };

type LeanFile = ProjectFileDoc & { _id: unknown };

type LoadedFile =
  | { ok: true; file: LeanFile }
  | { ok: false; reason: "not-found" | "project-closed" };

async function loadForChange(id: string, session: ClientSession): Promise<LoadedFile> {
  const file = await ProjectFile.findById(id).session(session).lean();
  if (!file) return { ok: false, reason: "not-found" };
  const project = await Project.findById(file.projectId).session(session).lean();
  if (!project) return { ok: false, reason: "not-found" };
  if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };
  return { ok: true, file };
}

export async function setFileVisibility(input: {
  actor: AuditActor;
  id: string;
  visible: boolean;
}): Promise<FileResult> {
  await connectToDatabase();
  return withSession<FileResult>(async (session) => {
    const loaded = await loadForChange(input.id, session);
    if (!loaded.ok) return { ok: false, reason: loaded.reason };
    if (loaded.file.status !== "active") return { ok: false, reason: "invalid-state" };
    await ProjectFile.updateOne({ _id: input.id }, { $set: { clientVisible: input.visible } }, { session });
    await recordAudit(
      {
        actor: input.actor,
        action: "file.visibility_changed",
        target: { type: "file", id: input.id },
        metadata: {
          projectId: loaded.file.projectId,
          filename: loaded.file.originalFilename,
          visible: input.visible,
        },
      },
      session,
    );
    return { ok: true };
  });
}

/** Archiving hides a file from everyone's lists and blocks client downloads. Nothing is hard-deleted. */
export async function archiveFile(input: { actor: AuditActor; id: string }): Promise<FileResult> {
  await connectToDatabase();
  return withSession<FileResult>(async (session) => {
    const loaded = await loadForChange(input.id, session);
    if (!loaded.ok) return { ok: false, reason: loaded.reason };
    if (loaded.file.status !== "active") return { ok: false, reason: "invalid-state" };
    await ProjectFile.updateOne(
      { _id: input.id, status: "active" },
      { $set: { status: "archived" } },
      { session },
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "file.archived",
        target: { type: "file", id: input.id },
        metadata: { projectId: loaded.file.projectId, filename: loaded.file.originalFilename },
      },
      session,
    );
    return { ok: true };
  });
}

export async function restoreFile(input: { actor: AuditActor; id: string }): Promise<FileResult> {
  await connectToDatabase();
  return withSession<FileResult>(async (session) => {
    const loaded = await loadForChange(input.id, session);
    if (!loaded.ok) return { ok: false, reason: loaded.reason };
    if (loaded.file.status !== "archived") return { ok: false, reason: "invalid-state" };
    await ProjectFile.updateOne(
      { _id: input.id, status: "archived" },
      { $set: { status: "active" } },
      { session },
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "file.restored",
        target: { type: "file", id: input.id },
        metadata: { projectId: loaded.file.projectId, filename: loaded.file.originalFilename },
      },
      session,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------- reads

async function deliverableInfo(ids: (string | undefined)[]) {
  const valid = [...new Set(ids.filter((id): id is string => Boolean(id) && isObjectId(id as string)))];
  if (valid.length === 0) return new Map<string, { title: string; clientVisible: boolean }>();
  const docs = await Deliverable.find({ _id: { $in: valid } })
    .select("title clientVisible")
    .lean();
  return new Map(
    docs.map((doc) => [String(doc._id), { title: doc.title, clientVisible: doc.clientVisible }]),
  );
}

function toView(doc: LeanFile, deliverableTitle: string | null, projectTitle: string | null): FileView {
  return {
    id: String(doc._id),
    projectId: doc.projectId,
    projectTitle,
    deliverableId: doc.deliverableId ?? null,
    deliverableTitle,
    filename: doc.originalFilename,
    format: doc.format,
    bytes: doc.bytes,
    clientVisible: doc.clientVisible,
    status: doc.status,
    uploadedByEmail: doc.uploadedByEmail,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt,
  };
}

/** Everything attached to a project, for staff. Callers must already have checked the project is readable. */
export async function listProjectFiles(projectId: string): Promise<FileView[]> {
  if (!isObjectId(projectId)) return [];
  await connectToDatabase();
  const docs = await ProjectFile.find({ projectId }).sort({ createdAt: -1 }).limit(200).lean();
  const deliverables = await deliverableInfo(docs.map((doc) => doc.deliverableId));
  return docs.map((doc) =>
    toView(doc, doc.deliverableId ? (deliverables.get(doc.deliverableId)?.title ?? null) : null, null),
  );
}

/**
 * The files a client may see: their own organization's, active, shown to clients, and not attached to a deliverable
 * that is hidden from them. Starts from the organization on the signed-in account, never from the request.
 */
export async function listClientFiles(organizationId: string): Promise<FileView[]> {
  await connectToDatabase();
  const docs = await ProjectFile.find({ organizationId, status: "active", clientVisible: true })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  if (docs.length === 0) return [];

  const projectIds = [...new Set(docs.map((doc) => doc.projectId))].filter(isObjectId);
  // Scoped again to the organization: a file whose project isn't this client's is dropped even if it slipped through.
  const projects = await Project.find({ ...clientProjectFilter(organizationId), _id: { $in: projectIds } })
    .select("title")
    .lean();
  const projectTitles = new Map(projects.map((project) => [String(project._id), project.title]));
  const deliverables = await deliverableInfo(docs.map((doc) => doc.deliverableId));

  return docs
    .filter((doc) => projectTitles.has(doc.projectId))
    .filter((doc) =>
      clientMayDownload({
        clientOrganizationId: organizationId,
        fileOrganizationId: doc.organizationId,
        fileStatus: doc.status,
        fileClientVisible: doc.clientVisible,
        hasDeliverable: Boolean(doc.deliverableId),
        deliverableClientVisible: doc.deliverableId
          ? deliverables.get(doc.deliverableId)?.clientVisible === true
          : false,
      }),
    )
    .map((doc) =>
      toView(
        doc,
        doc.deliverableId ? (deliverables.get(doc.deliverableId)?.title ?? null) : null,
        projectTitles.get(doc.projectId) ?? null,
      ),
    );
}

export interface FileForDownload {
  id: string;
  projectId: string;
  organizationId: string;
  deliverableId: string | null;
  publicId: string;
  format: string;
  originalFilename: string;
  status: "active" | "archived";
  clientVisible: boolean;
  /** null when the file isn't attached to a deliverable. */
  deliverableClientVisible: boolean | null;
}

export async function loadFileForDownload(fileId: string): Promise<FileForDownload | null> {
  if (!isObjectId(fileId)) return null;
  await connectToDatabase();
  const file = await ProjectFile.findById(fileId).lean();
  if (!file) return null;
  let deliverableClientVisible: boolean | null = null;
  if (file.deliverableId) {
    const info = await deliverableInfo([file.deliverableId]);
    deliverableClientVisible = info.get(file.deliverableId)?.clientVisible === true;
  }
  return {
    id: String(file._id),
    projectId: file.projectId,
    organizationId: file.organizationId,
    deliverableId: file.deliverableId ?? null,
    publicId: file.publicId,
    format: file.format,
    originalFilename: file.originalFilename,
    status: file.status,
    clientVisible: file.clientVisible,
    deliverableClientVisible,
  };
}
