// Все тесты сервиса по категориям.
// Новый тест: создайте файл в папке категории (по образцу соседних) и добавьте его в список ниже.
// Порядок здесь — порядок запуска тестов и вывода в отчёте.
// icon — иконка категории из набора Feather (см. раздел «Иконки» в UI-ките),
// shortTitle — короткое название для плиток сводки на дашборде.

import httpsAndSsl from './availability/https-and-ssl.js';
import homepageHttpStatus from './availability/homepage-http-status.js';
import custom404Page from './availability/custom-404-page.js';
import brokenLinks from './availability/broken-links.js';
import formsSpamProtection from './availability/forms-spam-protection.js';

import menuLinks from './navigation/menu-links.js';
import dropdownSubmenu from './navigation/dropdown-submenu.js';
import mobileMenu from './navigation/mobile-menu.js';
import logoHome from './navigation/logo-home.js';
import footerContent from './navigation/footer-content.js';
import footerSocialLinks from './navigation/footer-social-links.js';
import scrollToTop from './navigation/scroll-to-top.js';

import searchResults from './search-pagination/search-results.js';
import searchNoResults from './search-pagination/search-no-results.js';
import doctorsPagination from './search-pagination/doctors-pagination.js';
import newsPagination from './search-pagination/news-pagination.js';
import articlesPagination from './search-pagination/articles-pagination.js';
import galleryPagination from './search-pagination/gallery-pagination.js';
import libraryPagination from './search-pagination/library-pagination.js';
import reviewsPagination from './search-pagination/reviews-pagination.js';
import videosPagination from './search-pagination/videos-pagination.js';
import languageSwitch from './search-pagination/language-switch.js';
import priceFilter from './search-pagination/price-filter.js';

import doctorsHomepageBlock from './content/doctors-homepage-block.js';
import newsFeedHomepage from './content/news-feed-homepage.js';
import doctorProfileOpen from './content/doctor-profile-open.js';
import departmentPagesLoad from './content/department-pages-load.js';
import departmentContentComplete from './content/department-content-complete.js';
import priceListStructure from './content/price-list-structure.js';
import checkupPrograms from './content/checkup-programs.js';

import mobileAdaptiveNoScroll from './visual/mobile-adaptive-no-scroll.js';
import crossBrowser from './visual/cross-browser.js';
import homepageAdvantagesBlock from './visual/homepage-advantages-block.js';
import brokenImagesSitewide from './visual/broken-images-sitewide.js';

import headerBookingForm from './forms/header-booking-form.js';
import headerBookingPhoneNormalization from './forms/header-booking-phone-normalization.js';
import headerBookingConsentCheckbox from './forms/header-booking-consent-checkbox.js';

import callbackWidgetOpen from './widgets/callback-widget-open.js';
import callbackWidgetMobileOverlap from './widgets/callback-widget-mobile-overlap.js';
import chatWidgetLoads from './widgets/chat-widget-loads.js';
import whatsappButtonLink from './widgets/whatsapp-button-link.js';
import telegramButtonLink from './widgets/telegram-button-link.js';
import headerPhoneClickableMobile from './widgets/header-phone-clickable-mobile.js';

import titlePresent from './seo/title-present.js';
import descriptionPresent from './seo/description-present.js';
import h1Present from './seo/h1-present.js';
import headingHierarchy from './seo/heading-hierarchy.js';

import xmlSitemap from './seo-infrastructure/xml-sitemap.js';
import openGraph from './seo-infrastructure/open-graph.js';
import canonicalUrls from './seo-infrastructure/canonical-urls.js';
import robotsMeta from './seo-infrastructure/robots-meta.js';
import breadcrumbSchema from './seo-infrastructure/breadcrumb-schema.js';

import yandexSmartcaptcha from './antispam/yandex-smartcaptcha.js';

export const categories = [
  {
    id: 'availability',
    icon: 'feather-shield',
    title: 'Техническая доступность и безопасность',
    shortTitle: 'Доступность',
    tests: [httpsAndSsl, homepageHttpStatus, custom404Page, brokenLinks, formsSpamProtection],
  },
  {
    id: 'navigation',
    icon: 'feather-compass',
    title: 'Навигация, шапка и футер',
    shortTitle: 'Навигация',
    tests: [menuLinks, dropdownSubmenu, mobileMenu, logoHome, footerContent, footerSocialLinks, scrollToTop],
  },
  {
    id: 'search-pagination',
    icon: 'feather-search',
    title: 'Поиск, фильтры, пагинации и языковые сервисы',
    shortTitle: 'Поиск и фильтры',
    tests: [
      searchResults,
      searchNoResults,
      doctorsPagination,
      newsPagination,
      articlesPagination,
      galleryPagination,
      libraryPagination,
      reviewsPagination,
      videosPagination,
      languageSwitch,
      priceFilter,
    ],
  },
  {
    id: 'content',
    icon: 'feather-file-text',
    title: 'Контент и данные',
    shortTitle: 'Контент',
    tests: [
      doctorsHomepageBlock,
      newsFeedHomepage,
      doctorProfileOpen,
      departmentPagesLoad,
      departmentContentComplete,
      priceListStructure,
      checkupPrograms,
    ],
  },
  {
    id: 'visual',
    icon: 'feather-monitor',
    title: 'Визуал, адаптивность и кроссбраузерность',
    shortTitle: 'Визуал',
    tests: [mobileAdaptiveNoScroll, crossBrowser, homepageAdvantagesBlock, brokenImagesSitewide],
  },
  {
    id: 'forms',
    icon: 'feather-check-square',
    title: 'Формы, валидации и согласия',
    shortTitle: 'Формы',
    tests: [headerBookingForm, headerBookingPhoneNormalization, headerBookingConsentCheckbox],
  },
  {
    id: 'widgets',
    icon: 'feather-message-circle',
    title: 'Виджеты, связь и внешние сервисы',
    shortTitle: 'Виджеты',
    tests: [
      callbackWidgetOpen,
      callbackWidgetMobileOverlap,
      chatWidgetLoads,
      whatsappButtonLink,
      telegramButtonLink,
      headerPhoneClickableMobile,
    ],
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
  {
    id: 'antispam',
    icon: 'feather-lock',
    title: 'Защита и антиспам',
    shortTitle: 'Антиспам',
    tests: [yandexSmartcaptcha],
  },
];
