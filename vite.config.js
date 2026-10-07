import {defineConfig} from 'vite';
export default defineConfig({server:{port:3100,proxy:{'/api':'http://127.0.0.1:5100','/media':'http://127.0.0.1:5100'}}});
