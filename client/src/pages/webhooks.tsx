import React from "react";
import { Heading } from "@/components/ui/heading";
import { WebhookManager } from "@/components/webhook/WebhookManager";
import MainLayout from "@/components/layout/MainLayout";

export default function WebhooksPage() {
  return (
    <MainLayout title="Webhooks">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              Configure webhooks to execute trades from external signals
            </p>
          </div>
        </div>
        <WebhookManager />
      </div>
    </MainLayout>
  );
}