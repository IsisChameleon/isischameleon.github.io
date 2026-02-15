import { defineCollection, z } from 'astro:content';

const experience = defineCollection({
  type: 'content',
  schema: z.object({
    company: z.string(),
    role: z.string(),
    location: z.string().optional(),
    start: z.string(),
    end: z.string().optional(),
    summary: z.string(),
    impact: z.array(z.string()),
    stack: z.array(z.string()),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
    status: z.string().optional(),
    links: z
      .object({
        github: z.string().url().optional(),
        demo: z.string().url().optional(),
      })
      .optional(),
  }),
});

export const collections = { experience, projects };
