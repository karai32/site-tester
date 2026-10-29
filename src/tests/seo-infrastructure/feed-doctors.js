// Фид врачей /yml/doctors.php открывается, это XML с тегом <shop> и в нём есть врачи
import { checkFeed } from '../helpers/feed.js';

export default {
  id: 'feed-doctors',
  title: 'Доступность фида /yml/doctors.php',

  async run(context) {
    return checkFeed(context, {
      path: '/yml/doctors.php',
      rootTag: 'shop',
      itemTag: 'doctor',
      itemsTitle: 'врачей',
    });
  },
};
