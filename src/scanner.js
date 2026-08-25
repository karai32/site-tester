import { site } from '../config/site.js';
import { httpsAndSsl } from './checks/availability/https-and-ssl.js';
import { homepageHttpStatus } from './checks/availability/homepage-http-status.js';
import { custom404Page } from './checks/availability/custom-404-page.js';
import { brokenLinks } from './checks/availability/broken-links.js';
import { formsSpamProtection } from './checks/availability/forms-spam-protection.js';
import { menuLinks } from './checks/navigation/menu-links.js';
import { dropdownSubmenu } from './checks/navigation/dropdown-submenu.js';
import { mobileMenu } from './checks/navigation/mobile-menu.js';
import { logoHome } from './checks/navigation/logo-home.js';
import { footerContent } from './checks/navigation/footer-content.js';
import { footerSocialLinks } from './checks/navigation/footer-social-links.js';
import { scrollToTop } from './checks/navigation/scroll-to-top.js';
import { searchResults } from './checks/search-pagination/search-results.js';
import { searchNoResults } from './checks/search-pagination/search-no-results.js';
import { doctorsPagination } from './checks/search-pagination/doctors-pagination.js';
import { newsPagination } from './checks/search-pagination/news-pagination.js';
import { languageSwitch } from './checks/search-pagination/language-switch.js';
import { priceFilter } from './checks/search-pagination/price-filter.js';
import { doctorsHomepageBlock } from './checks/content/doctors-homepage-block.js';
import { newsFeedHomepage } from './checks/content/news-feed-homepage.js';
import { doctorProfileOpen } from './checks/content/doctor-profile-open.js';
import { departmentPagesLoad } from './checks/content/department-pages-load.js';
import { departmentContentComplete } from './checks/content/department-content-complete.js';
import { priceListStructure } from './checks/content/price-list-structure.js';
import { checkupPrograms } from './checks/content/checkup-programs.js';
import { crossBrowser } from './checks/visual/cross-browser.js';
import { mobileAdaptiveNoScroll } from './checks/visual/mobile-adaptive-no-scroll.js';
import { homepageAdvantagesBlock } from './checks/visual/homepage-advantages-block.js';
import { brokenImagesSitewide } from './checks/visual/broken-images-sitewide.js';
import { headerBookingForm } from './checks/forms/header-booking-form.js';
import { headerBookingPrivacyLink } from './checks/forms/header-booking-privacy-link.js';
import { headerBookingPhoneNormalization } from './checks/forms/header-booking-phone-normalization.js';
import { headerBookingConsentCheckbox } from './checks/forms/header-booking-consent-checkbox.js';
import { callbackWidgetOpen } from './checks/widgets/callback-widget-open.js';
import { callbackWidgetMobileOverlap } from './checks/widgets/callback-widget-mobile-overlap.js';
import { chatWidgetLoads } from './checks/widgets/chat-widget-loads.js';
import { whatsappButtonLink } from './checks/widgets/whatsapp-button-link.js';
import { telegramButtonLink } from './checks/widgets/telegram-button-link.js';
import { headerPhoneClickableMobile } from './checks/widgets/header-phone-clickable-mobile.js';
import { titlePresent } from './checks/seo/title-present.js';
import { descriptionPresent } from './checks/seo/description-present.js';
import { h1Present } from './checks/seo/h1-present.js';
import { headingHierarchy } from './checks/seo/heading-hierarchy.js';
import { no404Links } from './checks/seo/no-404-links.js';
import { yandexSmartcaptcha } from './checks/antispam/yandex-smartcaptcha.js';

const categories = [
  {
    id: 'availability',
    title: 'Техническая доступность и безопасность',
    checks: [httpsAndSsl, homepageHttpStatus, custom404Page, brokenLinks, formsSpamProtection],
  },
  {
    id: 'navigation',
    title: 'Навигация, шапка и футер',
    checks: [menuLinks, dropdownSubmenu, mobileMenu, logoHome, footerContent, footerSocialLinks, scrollToTop],
  },
  {
    id: 'search-pagination',
    title: 'Поиск, фильтры, пагинация и языковые версии',
    checks: [searchResults, searchNoResults, doctorsPagination, newsPagination, languageSwitch, priceFilter],
  },
  {
    id: 'content',
    title: 'Контент и данные',
    checks: [
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
    title: 'Визуал, адаптивность и кроссбраузерность',
    checks: [mobileAdaptiveNoScroll, crossBrowser, homepageAdvantagesBlock, brokenImagesSitewide],
  },
  {
    id: 'forms',
    title: 'Формы, валидация и согласия',
    checks: [
      headerBookingForm,
      headerBookingPrivacyLink,
      headerBookingPhoneNormalization,
      headerBookingConsentCheckbox,
    ],
  },
  {
    id: 'widgets',
    title: 'Виджеты, связь и внешние сервисы',
    checks: [
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
    title: 'SEO',
    checks: [titlePresent, descriptionPresent, h1Present, headingHierarchy, no404Links],
  },
  {
    id: 'antispam',
    title: 'Защита и антиспам',
    checks: [yandexSmartcaptcha],
  },
];

export function getCheckDefinitions() {
  return categories.map(({ id, title, checks }) => ({
    id,
    title,
    checks: checks.map(({ id: checkId, title: checkTitle }) => ({ id: checkId, title: checkTitle })),
  }));
}

export async function runScan() {
  const groups = [];

  for (const category of categories) {
    const checks = [];
    for (const check of category.checks) {
      checks.push(await check.run({ url: site.baseUrl }));
    }

    groups.push({
      id: category.id,
      title: category.title,
      status: checks.every((check) => check.status === 'passed') ? 'passed' : 'failed',
      checks,
    });
  }

  const passed = groups.every((group) => group.status === 'passed');

  return {
    passed,
    report: { groups },
    error: null,
  };
}
