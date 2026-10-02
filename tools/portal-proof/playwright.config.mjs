import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./browser-tests',workers:1,fullyParallel:false,
  use:{baseURL:'http://127.0.0.1:4702'},projects:[
    {name:'mobile',use:{...devices['iPhone 13'],browserName:'chromium'}},
    {name:'desktop',use:{...devices['Desktop Chrome'],browserName:'chromium'}}
  ]});
