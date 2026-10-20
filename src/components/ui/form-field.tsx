import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}

/** Label above, hint below; an error replaces the hint. Wires ids and ARIA for the control. */
export function FormField({ id, label, hint, error, required, className, children }: FormFieldProps) {
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-foreground block text-[13px] font-medium">
        {label}
        {required ? (
          <span aria-hidden className="text-danger ml-0.5">
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {message ? (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={cn("text-xs", error ? "text-danger font-medium" : "text-muted-foreground")}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
