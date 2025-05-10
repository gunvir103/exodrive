/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://exodrive.co',
  generateRobotsTxt: false, // We'll use App Router's robots.ts instead
  exclude: ['/admin/**'],
};  