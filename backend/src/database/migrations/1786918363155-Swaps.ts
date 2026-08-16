import { MigrationInterface, QueryRunner } from "typeorm";

export class Swaps1786918363155 implements MigrationInterface {
    name = 'Swaps1786918363155'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Appeals/voting replaced by peer-to-peer swaps — drop the old tables and
        // their enum types (TypeORM won't drop entities it no longer tracks).
        await queryRunner.query(`DROP TABLE IF EXISTS "AppealVote"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "Appeal"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."Appeal_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."AppealVote_value_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."SwapRequest_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "SwapRequest" ("id" uuid NOT NULL, "circleId" uuid NOT NULL, "requesterId" uuid NOT NULL, "targetId" uuid NOT NULL, "status" "public"."SwapRequest_status_enum" NOT NULL DEFAULT 'PENDING', "note" character varying, "targetRespondedAt" TIMESTAMP, "coordinatorId" uuid, "decidedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ef945433af3c41abad73b3c724b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e5e5cf1b965927cdd49e66cb74" ON "SwapRequest"  ("targetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4d132ec1e8e6ff691be6c7451" ON "SwapRequest"  ("requesterId") `);
        await queryRunner.query(`CREATE INDEX "IDX_404191dd5befc13a695dfbdaba" ON "SwapRequest"  ("circleId", "status") `);
        await queryRunner.query(`ALTER TABLE "SwapRequest" ADD CONSTRAINT "FK_8e317785d22df029de81ed145f1" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SwapRequest" ADD CONSTRAINT "FK_f4d132ec1e8e6ff691be6c74512" FOREIGN KEY ("requesterId") REFERENCES "Membership"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SwapRequest" ADD CONSTRAINT "FK_e5e5cf1b965927cdd49e66cb74d" FOREIGN KEY ("targetId") REFERENCES "Membership"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SwapRequest" ADD CONSTRAINT "FK_20de9d7a2ea179241d27520987f" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SwapRequest" DROP CONSTRAINT "FK_20de9d7a2ea179241d27520987f"`);
        await queryRunner.query(`ALTER TABLE "SwapRequest" DROP CONSTRAINT "FK_e5e5cf1b965927cdd49e66cb74d"`);
        await queryRunner.query(`ALTER TABLE "SwapRequest" DROP CONSTRAINT "FK_f4d132ec1e8e6ff691be6c74512"`);
        await queryRunner.query(`ALTER TABLE "SwapRequest" DROP CONSTRAINT "FK_8e317785d22df029de81ed145f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_404191dd5befc13a695dfbdaba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4d132ec1e8e6ff691be6c7451"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e5e5cf1b965927cdd49e66cb74"`);
        await queryRunner.query(`DROP TABLE "SwapRequest"`);
        await queryRunner.query(`DROP TYPE "public"."SwapRequest_status_enum"`);
    }

}
