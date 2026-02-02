import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
        plugins: [sveltekit(), tailwindcss()],
        preview: {
                port: 4403,
                host: '0.0.0.0',
                allowedHosts: ['inuaquicklink.co.ke']
        }
});