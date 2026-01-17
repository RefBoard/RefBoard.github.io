import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 웹 배포용 설정
// /refboard/ 폴더에 배포하는 경우
export default defineConfig({
    plugins: [react()],
    base: '/refboard/', // /refboard/ 폴더에 배포
    build: {
        outDir: 'dist-web',
        assetsDir: 'assets',
        sourcemap: false,
    },
})

