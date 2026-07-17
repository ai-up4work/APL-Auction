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
            }

        ],
    },
};

module.exports = nextConfig;