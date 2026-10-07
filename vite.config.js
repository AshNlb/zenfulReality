import {defineConfig} from 'vite';
export default defineConfig({server:{port:3100,proxy:{'/api':process.env.LOCAL_API_TARGET||'http://127.0.0.1:5100','/media':process.env.LOCAL_API_TARGET||'http://127.0.0.1:5100'}}});
