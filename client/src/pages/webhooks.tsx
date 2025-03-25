import React from "react";
import { Heading } from "@/components/ui/heading";
import { WebhookManager } from "@/components/webhook/WebhookManager";
import MainLayout from "@/components/layout/MainLayout";

export default function WebhooksPage() {
  return (
    <MainLayout title="TradingView Webhooks">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">TradingView Webhooks</h1>
            <p className="text-muted-foreground">
              Configure webhooks to execute trades from TradingView alerts
            </p>
          </div>
        </div>
        <WebhookManager />
      </div>
    </MainLayout>
  );
}