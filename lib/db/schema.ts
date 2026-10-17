import { sql } from "drizzle-orm";
import type { CompanyEditFields } from "@/lib/company-edit";
import type { SocialLinks } from "@/lib/social-links";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

/* -------------------------------------------------------------------------- */
/*  Better Auth core tables                                                   */
/*  Profile fields (username, bio, socials, show_email) are folded onto the   */
/*  `user` table — no separate profiles table, no FK dance, no signup trigger.*/
/*  name/email/image are Better Auth natives.                                 */
/* -------------------------------------------------------------------------- */

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),

    // ---- folded-in profile fields (was public.profiles) ----
    username: text("username"),
    fullName: text("full_name"),
    bio: text("bio"),
    /** Profile links by platform (lib/social-links.ts) — one JSON object. */
    socialLinks: text("social_links", { mode: "json" }).$type<SocialLinks>(),
    showEmail: integer("show_email", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    uniqueIndex("user_username_lower_idx").on(sql`lower(${t.username})`),
  ],
);

export const session = sqliteTable(
  "session",
  {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId), index("session_expires_idx").on(t.expiresAt)],
);

export const account = sqliteTable(
  "account",
  {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (t) => [
    index("verification_identifier_idx").on(t.identifier),
    index("verification_expires_idx").on(t.expiresAt),
  ],
);

// Better Auth rate-limit store. Persisted in D1 so the limiter works across
// Worker isolates (the default in-memory store resets per isolate = useless).
// Every auth request looks its row up by key and prunes by last_request, so
// both are indexed (without them each lookup scanned the whole table).
export const rateLimit = sqliteTable(
  "rateLimit",
  {
    id: text("id").primaryKey(),
    key: text("key"),
    count: integer("count"),
    lastRequest: integer("last_request"),
  },
  (t) => [
    uniqueIndex("rate_limit_key_idx").on(t.key),
    index("rate_limit_last_request_idx").on(t.lastRequest),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Application tables (user data: favorites, notifications, clicks, etc.)    */
/*  RLS dropped — authorization enforced in app code (lib/authz.ts).          */
/* -------------------------------------------------------------------------- */

// was public.favorites — composite PK (user_id, resource_id)
export const favorites = sqliteTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resourceId: text("resource_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  // resource_id index: the public per-resource counts group by it.
  (t) => [
    primaryKey({ columns: [t.userId, t.resourceId] }),
    index("favorites_resource_idx").on(t.resourceId),
  ],
);

// was public.notifications
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title"),
    body: text("body"),
    resourceId: text("resource_id"),
    url: text("url"),
    // Structured payload ({ kind, name, reason, … }) the UI renders in the
    // reader's language; title/body hold the English fallback.
    data: text("data", { mode: "json" }).$type<Record<string, string>>(),
    // unique-when-not-null → webhook idempotency
    sourceKey: text("source_key"),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("notifications_source_key_idx")
      .on(t.sourceKey)
      .where(sql`${t.sourceKey} is not null`),
  ],
);

// was public.resource_clicks — public read, incremented via atomic UPSERT
export const resourceClicks = sqliteTable("resource_clicks", {
  resourceId: text("resource_id").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// was public.submissions — mirror of Sanity submission docs
export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    sanitySubmissionId: text("sanity_submission_id"),
    kind: text("kind").notNull().default("new"), // new | fix | taxonomy
    targetResourceId: text("target_resource_id"),
    name: text("name"),
    url: text("url"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    suggestedCategory: text("suggested_category"),
    pricing: text("pricing"), // free | freemium | paid
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    proposedCategories: text("proposed_categories", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    proposedTags: text("proposed_tags", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    proposedDescription: text("proposed_description"),
    // Edit suggestions can also rename, re-link or report a resource as gone.
    proposedName: text("proposed_name"),
    proposedUrl: text("proposed_url"),
    proposeRemoval: integer("propose_removal", { mode: "boolean" }).notNull().default(false),
    // Company edit suggestions: the changed fields and their values at submit
    // time ({ name, website, careerUrl, linkedin, emails }), for the diff view.
    proposedFields: text("proposed_fields", { mode: "json" }).$type<CompanyEditFields>(),
    originalFields: text("original_fields", { mode: "json" }).$type<CompanyEditFields>(),
    originalCategories: text("original_categories", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    originalTags: text("original_tags", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    originalDescription: text("original_description"),
    note: text("note"),
    rejectionReason: text("rejection_reason"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("submissions_user_idx").on(t.userId),
    index("submissions_sanity_idx").on(t.sanitySubmissionId),
  ],
);

// Company application tracker — one row per (user, company) the user saved.
// companyId is the Sanity company _id. Private: never exposed to other users.
export const companyApplications = sqliteTable(
  "company_applications",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: text("company_id").notNull(),
    // saved | applied | interview | offer | rejected (lib/company-taxonomy.ts)
    status: text("status").notNull().default("saved"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.companyId] }),
    index("company_applications_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  CV directory. The PDF lives in R2 (CV_BUCKET); this row is its listing.   */
/* -------------------------------------------------------------------------- */

// One CV per user. Listed only once an editor approves it in Sanity
// (status "published"); the owner can unlist it ("hidden") at any time.
export const cvs = sqliteTable(
  "cvs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    field: text("field").notNull(),
    seniority: text("seniority").notNull(),
    language: text("language").notNull(),
    technologies: text("technologies", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    summary: text("summary"),
    fileKey: text("file_key").notNull(),
    fileSize: integer("file_size").notNull(),
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    sanitySubmissionId: text("sanity_submission_id"),
    // Denormalized so listing never counts the likes table.
    likeCount: integer("like_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    publishedAt: integer("published_at", { mode: "timestamp" }),
  },
  (t) => [index("cvs_status_published_idx").on(t.status, t.publishedAt)],
);

export const cvLikes = sqliteTable(
  "cv_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cvId: text("cv_id")
      .notNull()
      .references(() => cvs.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.cvId] }), index("cv_likes_cv_idx").on(t.cvId)],
);
