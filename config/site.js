export const site = Object.freeze({
  name: process.env.SITE_NAME || 'Проверяемый сайт',
  baseUrl: process.env.SITE_URL || 'https://example.com',

  pages: {
    home: '/',
  },

  selectors: {},
  expected: {},
});
