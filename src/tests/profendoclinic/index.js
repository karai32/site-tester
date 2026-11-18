import httpsAndSsl from './availability/https-and-ssl.js';
import homepageHttpStatus from './availability/homepage-http-status.js';
import custom404Page from './availability/custom-404-page.js';
import brokenLinks from './availability/broken-links.js';

import brokenImagesSitewide from './visual/broken-images-sitewide.js';

import titlePresent from './seo/title-present.js';
import descriptionPresent from './seo/description-present.js';
import h1Present from './seo/h1-present.js';
import headingHierarchy from './seo/heading-hierarchy.js';

import xmlSitemap from './seo-infrastructure/xml-sitemap.js';
import openGraph from './seo-infrastructure/open-graph.js';
import canonicalUrls from './seo-infrastructure/canonical-urls.js';
import robotsMeta from './seo-infrastructure/robots-meta.js';
import breadcrumbSchema from './seo-infrastructure/breadcrumb-schema.js';

export default [
  {
    id: 'availability',
    icon: 'feather-shield',
    title: 'Техническая доступность и безопасность',
    shortTitle: 'Доступность',
    tests: [httpsAndSsl, homepageHttpStatus, custom404Page, brokenLinks],
  },
  {
    id: 'visual',
    icon: 'feather-monitor',
    title: 'Визуал, адаптивность и кроссбраузерность',
    shortTitle: 'Визуал',
    tests: [brokenImagesSitewide],
  },
  {
    id: 'seo',
    icon: 'feather-bar-chart-2',
    title: 'SEO',
    shortTitle: 'SEO',
    tests: [titlePresent, descriptionPresent, h1Present, headingHierarchy],
  },
  {
    id: 'seo-infrastructure',
    icon: 'feather-globe',
    title: 'SEO-инфраструктура',
    shortTitle: 'SEO-инфраструктура',
    tests: [xmlSitemap, openGraph, canonicalUrls, robotsMeta, breadcrumbSchema],
  },
];
