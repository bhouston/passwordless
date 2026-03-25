import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const passkeys = sqliteTable('passkeys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  authenticatorType: text('authenticator_type', {
    enum: ['platform', 'cross-platform'],
  }).notNull(),
  name: text('name'),
  transports: text('transports'), // JSON array of transport methods
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
});

export const otpChallenges = sqliteTable(
  'otp_challenges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    operation: text('operation', {
      enum: ['signup', 'login'],
    }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name'),
    codeHash: text('code_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    operationEmailIdx: index('otp_challenges_operation_email_idx').on(table.operation, table.email),
    operationUserIdIdx: index('otp_challenges_operation_user_id_idx').on(table.operation, table.userId),
    expiresAtIdx: index('otp_challenges_expires_at_idx').on(table.expiresAt),
  }),
);
