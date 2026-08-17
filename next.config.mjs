/** @type {import('next').NextConfig} */
export default {
  images: {
    remotePatterns: [
      // troque pelo host do seu projeto Supabase
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};
