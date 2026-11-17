import { checkFeed } from '../helpers.js';

export default {
  id: 'feed-any-query',
  title: 'Доступность фида /yml/any-query.php',

  async run(context) {
    return checkFeed(context, {
      path: '/yml/any-query.php',
      rootTag: 'yml_catalog',
      itemTag: 'offer',
      itemsTitle: 'предложений (offer)',
    });
  },
};
