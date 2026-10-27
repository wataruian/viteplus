import { z } from '@hono/zod-openapi';
import { generateShortUuid } from '@lightproject/common/utils';
import { createDatabaseStore, createJobClient, ping } from '@lightproject/tasks';

import { attachSchema } from '../schema';

class TestService {
  public static readonly createUser = attachSchema(
    async (_input: Record<string, never>, { getDatabase }) => {
      const database = await getDatabase();
      const suffix = generateShortUuid();
      const user = await database.users.insert({
        email: `user-${suffix}@example.com`,
        name: `User ${suffix.slice(0, 8)}`,
      });
      return {
        createdAt: user.createdAt.toISOString(),
        email: user.email,
        id: user.id,
        name: user.name,
      };
    },
    {
      request: z.object({}).openapi('CreateUserRequest'),
      response: z
        .object({ createdAt: z.string(), email: z.string(), id: z.string(), name: z.string() })
        .openapi('CreateUserResponse'),
    },
  );

  public static readonly enqueuePing = attachSchema(
    async (input: { message?: string | undefined }, { getDatabase }) => {
      const jobs = createJobClient(createDatabaseStore(await getDatabase()));
      const job = await jobs.enqueue(ping, {
        message: input.message ?? 'Hello from the backend',
      });
      return {
        functionName: job.functionName,
        id: job.id,
        runAt: job.runAt.toISOString(),
        status: job.status,
      };
    },
    {
      request: z.object({ message: z.string().optional() }).openapi('EnqueuePingRequest'),
      response: z
        .object({ functionName: z.string(), id: z.string(), runAt: z.string(), status: z.string() })
        .openapi('EnqueuePingResponse'),
    },
  );

  public static readonly hello = attachSchema(
    (input: { name?: string | undefined }) => {
      const reply = `Hello ${input.name !== undefined && input.name.length > 0 ? input.name : 'World'}!`;
      return { reply };
    },
    {
      request: z.object({ name: z.string().optional() }).openapi('HelloRequest'),
      response: z.object({ reply: z.string() }).openapi('HelloResponse'),
    },
  );

  public static readonly profile = attachSchema(
    (input: {
      age: number;
      name: string;
      preferences: { notifications: boolean; theme: 'dark' | 'light' };
      tags: string[];
    }) => {
      const slug = input.name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .split('-')
        .filter(Boolean)
        .join('-');

      const profile = {
        id: `profile_${slug}`,
        metadata: {
          createdAt: new Date().toISOString(),
          version: 1,
        },
        profile: {
          age: input.age,
          name: input.name,
          tags: input.tags,
        },
        settings: {
          notifications: input.preferences.notifications,
          theme: input.preferences.theme,
        },
      };
      return profile;
    },
    {
      request: z
        .object({
          age: z.number().int().min(0),
          name: z.string().min(1),
          preferences: z.object({
            notifications: z.boolean(),
            theme: z.enum(['light', 'dark']),
          }),
          tags: z.array(z.string()),
        })
        .openapi('CreateProfileRequest'),
      response: z
        .object({
          id: z.string(),
          metadata: z.object({
            createdAt: z.string(),
            version: z.number(),
          }),
          profile: z.object({
            age: z.number(),
            name: z.string(),
            tags: z.array(z.string()),
          }),
          settings: z.object({
            notifications: z.boolean(),
            theme: z.enum(['light', 'dark']),
          }),
        })
        .openapi('CreateProfileResponse'),
    },
  );
}

export { TestService };
