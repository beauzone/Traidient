import React from "react";
import { Heading } from "@/components/ui/heading";
import { WebhookManager } from "@/components/webhook/WebhookManager";

export default function WebhooksPage() {
  return (
    <div className="h-full p-6">
      <WebhookManager />
    </div>
  );
}