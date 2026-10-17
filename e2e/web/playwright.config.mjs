import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sizes=[['phone',{width:390,height:844}],['tablet',{width:820,height:1180}],['desktop',{width:1440,height:900}]];
export default defineConfig({
  testDir:'.',testMatch:'*.spec.mjs',fullyParallel:false,workers:1,timeout:30000,
  outputDir:root+'/.build/web-browser',reporter:[['list'],['json',{outputFile:root+'/.build/web-browser-result.json'}]],
  use:{baseURL:'http://127.0.0.1:18427/hub/',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:['chromium','firefox','webkit'].flatMap(browserName=>sizes.map(([size,viewport])=>({name:`${browserName}-${size}`,use:{browserName,viewport,...(browserName==='chromium'&&process.env.WEB_CHROMIUM_EXECUTABLE?{launchOptions:{executablePath:process.env.WEB_CHROMIUM_EXECUTABLE}}:{})}}))),
  webServer:{command:'node e2e/web/serve.mjs',cwd:root,url:'http://127.0.0.1:18427/hub/',reuseExistingServer:false,timeout:30000}
});
