import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  dataJson: text("data_json").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
export const memberships = sqliteTable(
  "memberships",
  {
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    joinedAt: text("joined_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.userId] })],
);
export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id),
  tokenHash: text("token_hash").notNull().unique(),
  role: text("role").notNull(),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("pending"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  acceptedBy: text("accepted_by"),
  createdBy: text("created_by").notNull(),
});
