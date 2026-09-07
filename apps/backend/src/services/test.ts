import { z } from '@hono/zod-openapi';

import { attachSchema } from '../schema';

class TestService {
  public static hello = attachSchema(
    (input: { name?: string | undefined }) => {
      const reply = `Hello ${input.name !== undefined && input.name.length > 0 ? input.name : 'World'}!`;
      return { reply };
    },
    {
      request: z.object({ name: z.string().optional() }).openapi('HelloRequest'),
      response: z.object({ reply: z.string() }).openapi('HelloResponse'),
    },
  );

  public static profile = attachSchema(
    (input: {
      age: number;
      name: string;
      preferences: { notifications: boolean; theme: 'dark' | 'light' };
      tags: string[];
    }) => {
      const slug = input.name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-+|-+$/gu, '');

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
