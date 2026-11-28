// Where buyers send their payment. These details are shown publicly on the showcase pages.
export type PaymentMethodId = "ubl_bank" | "jazzcash";

export interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban?: string;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  {
    id: "ubl_bank",
    label: "UBL bank transfer",
    bankName: "United Bank Limited (UBL)",
    accountTitle: "Amjad ullah",
    accountNumber: "1095341691992",
    iban: "PK50UNIL0109000341691992",
  },
  {
    id: "jazzcash",
    label: "JazzCash",
    bankName: "JazzCash",
    accountTitle: "Shafi ullah",
    accountNumber: "03069534618",
  },
];

export const PAYMENT_METHOD_IDS = ["ubl_bank", "jazzcash"] as const;

export const SUPPORT_WHATSAPP_URL = "https://wa.me/923069534618";

export function paymentMethodLabel(id: string): string {
  return PAYMENT_METHODS.find((method) => method.id === id)?.label ?? id;
}
