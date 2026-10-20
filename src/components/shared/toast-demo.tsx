"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.success("Saved", { description: "Your changes were stored." })}
      >
        Success toast
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          toast.error("Upload failed", {
            description: "The file is larger than the limit.",
            action: { label: "Retry", onClick: () => {} },
          })
        }
      >
        Error toast
      </Button>
    </div>
  );
}
