import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMcpApiKeys1760000000000 implements MigrationInterface {
  name = 'CreateMcpApiKeys1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // The compiled production runner does not execute DatabaseModule hooks.
    // Ensure the UUID generator exists before creating the additive table.
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TABLE "mcp_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "publicId" character varying(64) NOT NULL,
        "prefix" character varying(20) NOT NULL,
        "verifier" character varying(64) NOT NULL,
        "hashVersion" smallint NOT NULL DEFAULT 1,
        "scopes" text[] NOT NULL DEFAULT ARRAY['tasks:read']::text[],
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "revokedById" uuid,
        "revokeReason" character varying(255),
        "replacedById" uuid,
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mcp_api_keys_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_mcp_api_keys_public_id" UNIQUE ("publicId"),
        CONSTRAINT "FK_mcp_api_keys_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mcp_api_keys_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_mcp_api_keys_owner_project" ON "mcp_api_keys" ("ownerId", "projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mcp_api_keys_project_revoked" ON "mcp_api_keys" ("projectId", "revokedAt")`,
    );
  }

  down(queryRunner: QueryRunner): Promise<void> {
    // Rollback disables the feature flags; it must retain additive keys and audits.
    void queryRunner;
    return Promise.resolve();
  }
}
