/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://exodrive.co',
  generateRobotsTxt: true,       // also creates robots.txt
  exclude: ['/admin/**'],
}; 