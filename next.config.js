/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: "oojlmezarojzymkjtcis.supabase.co"
            },
            {
                protocol: "https",
                hostname: "images.pexels.com",
            },
            {
                protocol: "https",
                hostname: "crystalpng.com",
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",   
            },
            {
                protocol: "https",
                hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com",
            }
        ],
    },
};

module.exports = nextConfig;