import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { getCategories } from '../src/features/home/services/categoriesService';
const { env } = require('node:process') as {
  env: Record<string, string | undefined>;
};
const liveTest = env.FRIENDIE_RUN_CATEGORIES_LIVE === 'true' ? test : test.skip;
liveTest(
  'configured live Laravel Categories parses through the production Axios service without authentication',
  async () => {
    const original = apiClient.defaults.adapter;
    const nodeAxios = require((
      require as unknown as { resolve: (id: string) => string }
    )
      .resolve('axios/package.json')
      .replace(/package\.json$/, 'dist/node/axios.cjs')) as typeof axios;
    apiClient.defaults.adapter = nodeAxios.getAdapter('http');
    try {
      expect(apiClient.defaults.baseURL).toBe(appConfig.apiBaseUrl);
      const categories = await getCategories();
      expect(Array.isArray(categories)).toBe(true);
      for (const category of categories) {
        expect(category.id).toMatch(/^[1-9]\d*$/);
        expect(typeof category.name).toBe('string');
        if (category.imageUrl)
          expect(category.imageUrl).toMatch(/^https?:\/\//);
      }
      if (categories.length) {
        const matching = await getCategories(
          undefined,
          categories[0].name.slice(0, 100),
        );
        expect(matching).toContainEqual(categories[0]);
      }
      expect(
        await getCategories(undefined, 'friendie-no-matching-category-839104'),
      ).toEqual([]);
      await expect(
        apiClient.get('/categories', {
          headers: { Authorization: false },
          params: { search: 'x'.repeat(101) },
        }),
      ).rejects.toMatchObject({
        status: 422,
        kind: 'validation',
        fields: { search: expect.any(Array) },
      });
    } finally {
      apiClient.defaults.adapter = original;
    }
  },
  30000,
);
