import React from "react";
import { WebhookManager } from "@/components/webhook/WebhookManager";
import MainLayout from "@/components/layout/MainLayout";

export default function WebhooksPage() {
  return (
    <MainLayout title="Webhooks">
      <WebhookManager />
    </MainLayout>
  );
}