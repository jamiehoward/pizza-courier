/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile three.js addons
  transpilePackages: ['three'],
  
  // Webpack config for Three.js
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glb|gltf|fbx)$/,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = nextConfig;
