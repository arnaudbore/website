import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
	pipelines: defineCollection({
		//type: 'data',
		loader: glob({
			pattern: '*.yaml',
			base: './src/content/pipelines',
		}),
		schema: z.object({
			name: z.string(),
			organisation: z.string(),
			documentation: z.string().optional(),
		}),
	}),
	repositories: defineCollection({
		loader: glob({
			pattern: '*.yaml',
			base: './src/content/repositories'
		}),
		schema: z.object({
			org: z.string(),
			repo: z.string(),
		}),
	}),
};