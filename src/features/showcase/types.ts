import type { OfferStatus, OrderStatus } from "./rules";

export interface PublicOffer {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  techStack: string[];
  liveUrl: string | null;
  caseStudySlug: string | null;
  priceMinor: number;
}

export interface OfferRow extends PublicOffer {
  status: OfferStatus;
  sortOrder: number;
}

export interface OrderRow {
  id: string;
  reference: string;
  buyerName: string;
  buyerEmail: string;
  offerTitle: string;
  priceMinor: number;
  paymentMethod: string;
  status: OrderStatus;
  createdAt: Date;
}

export interface OrderDetail extends OrderRow {
  offerId: string;
  buyerPhone: string | null;
  transactionRef: string | null;
  note: string | null;
  hasProof: boolean;
  history: { status: OrderStatus; at: Date; byEmail: string | null; note: string | null }[];
}

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export const initialActionState: ActionState = { status: "idle" };
