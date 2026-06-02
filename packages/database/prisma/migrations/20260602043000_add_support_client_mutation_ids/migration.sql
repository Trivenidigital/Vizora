-- Add client mutation ids so support request/message retries are idempotent.
ALTER TABLE "support_requests"
  ADD COLUMN "clientMutationId" VARCHAR(80);

ALTER TABLE "support_messages"
  ADD COLUMN "clientMutationId" VARCHAR(80);

CREATE UNIQUE INDEX "support_requests_org_user_client_mutation_key"
  ON "support_requests"("organizationId", "userId", "clientMutationId");

CREATE UNIQUE INDEX "support_messages_request_user_client_mutation_key"
  ON "support_messages"("requestId", "userId", "clientMutationId");
