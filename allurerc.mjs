import { defineConfig } from 'allure';

export default defineConfig({
  name: 'Conduit Playwright tests',
  output: './reports/allure-report',
  historyPath: './reports/allure-history.jsonl',
  plugins: {
    awesome: {
      options: {
        singleFile: false,
        reportLanguage: 'en',
      },
    },
  },
});
