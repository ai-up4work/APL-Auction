/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'picsum.photos',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
            { 
                protocol: 'https', 
                hostname: 'img1.hscicdn.com' 
            },
            {
                protocol: 'https',
                hostname: 'images.seeklogo.com',
            },
        ],
    },
};

module.exports = nextConfig;