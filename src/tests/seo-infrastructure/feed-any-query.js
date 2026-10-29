// YML-фид /yml/any-query.php открывается, это XML с тегом <yml_catalog> и в нём есть предложения
import { checkFeed } from '../helpers/feed.js';

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
