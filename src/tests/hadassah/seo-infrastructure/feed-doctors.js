import { checkFeed } from '../helpers.js';

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
