/* Поведение интерфейса: меню, вход, форма сценария и страница отчёта.
   Показ пароля повторяет assets/js/app.js из 808 Utilities. */
$(function () {
	'use strict';

	// Подменю «Выбранные проекты»: раскрыть / свернуть
	$(document).on('click', '[data-submenu-toggle]', function () {
		var open = !$(this).hasClass('open');
		$(this).toggleClass('open', open).attr('aria-expanded', open);
		$(this).next('ul').prop('hidden', !open);
	});

	// Меню на телефоне: открыть кнопкой, закрыть по затемнению
	$(document).on('click', '[data-mobile-open]', function () {
		$('.app').addClass('menu-open');
	});
	$(document).on('click', '[data-mobile-close]', function () {
		$('.app').removeClass('menu-open');
	});

	// Показать / скрыть пароль
	$(document).on('click', '.toggle-password', function () {
		var $input = $(this).siblings('.pass-input');
		var show = $input.attr('type') === 'password';
		$input.attr('type', show ? 'text' : 'password');
		$(this).toggleClass('feather-eye-off', !show).toggleClass('feather-eye', show);
	});

	// Вход: кнопка «Войти» серая, пока логин или пароль пустые
	$('[data-login-form]').each(function () {
		var $form = $(this);
		var update = function () {
			var filled = $form.find('#login').val().trim() !== '' && $form.find('#password').val() !== '';
			$form.find('[type="submit"]').prop('disabled', !filled);
		};
		$form.on('input', update);
		update();
	});

	// Форма сценария: галочка категории выбирает все её тесты.
	// Если выбрана только часть тестов, галочка категории — с чёрточкой (indeterminate).
	function updatePicker($group) {
		var $items = $group.find('.tree-items input[type="checkbox"]');
		var checked = $items.filter(':checked').length;
		var all = $group.find('[data-picker-all]')[0];
		all.checked = checked === $items.length;
		all.indeterminate = checked > 0 && checked < $items.length;
		$group.find('[data-picker-count]').text(checked + ' из ' + $items.length);
	}
	$('[data-picker]').each(function () {
		updatePicker($(this));
	});
	$(document).on('change', '[data-picker-all]', function () {
		var $group = $(this).closest('[data-picker]');
		$group.find('.tree-items input[type="checkbox"]').prop('checked', this.checked);
		updatePicker($group);
	});
	$(document).on('change', '[data-picker] .tree-items input', function () {
		updatePicker($(this).closest('[data-picker]'));
	});

	// Выбрали файл — форма отправляется сама (аватарка проекта)
	$(document).on('change', 'input[data-auto-submit]', function () {
		this.form.submit();
	});

	// Кнопка «Скопировать»: data-copy — что скопировать (новый API-ключ)
	$(document).on('click', '[data-copy]', function () {
		var $button = $(this);
		navigator.clipboard.writeText($button.data('copy')).then(function () {
			$button.text('Скопировано');
		});
	});
	// Поле с ключом: при нажатии выделяется целиком, чтобы скопировать вручную
	$(document).on('focus', '[data-select-on-focus]', function () {
		this.select();
	});

	// Формы с подтверждением: data-confirm — текст вопроса
	$(document).on('submit', 'form[data-confirm]', function (event) {
		if (!window.confirm($(this).data('confirm'))) event.preventDefault();
	});

	// Пока проверка идёт, страница отчёта обновляется сама (data-auto-refresh — через сколько секунд)
	var $autoRefresh = $('[data-auto-refresh]');
	if ($autoRefresh.length) {
		setTimeout(function () {
			window.location.reload();
		}, Number($autoRefresh.data('auto-refresh')) * 1000);
	}

	// «Показать ещё» в списке ошибок теста
	$(document).on('click', '[data-show-more]', function () {
		$(this).closest('.report-test').find('[data-more-item]').removeClass('d-none');
		$(this).remove();
	});

	// Скриншот или видео крупно в модальном окне
	$(document).on('click', '[data-media]', function () {
		var $modal = $('#media-modal');
		var src = $(this).data('media');
		var $body = $modal.find('[data-media-modal-body]').empty();
		if ($(this).data('media-type') === 'video') {
			$('<video controls autoplay class="media-modal-video">').attr('src', src).appendTo($body);
		} else {
			$('<img alt="" class="media-modal-image">').attr('src', src).appendTo($body);
		}
		$modal.find('[data-media-modal-caption]').text($(this).data('media-caption'));
		bootstrap.Modal.getOrCreateInstance($modal[0]).show();
	});
	// Закрыли окно — останавливаем видео
	$(document).on('hidden.bs.modal', '#media-modal', function () {
		$(this).find('[data-media-modal-body]').empty();
	});

	// Сводка по сценарию на дашборде: выбрали сценарий — берём сводку с сервера и вставляем в страницу
	$(document).on('change', '[data-scenario-summary-select]', function () {
		var $box = $('[data-scenario-summary]');
		if (!this.value) {
			$box.empty(); // «Выберите сценарий» — сводку убираем
			return;
		}
		$box.html('<p class="panel__empty">Загрузка…</p>');
		$.get($(this).data('url'), { scenario: this.value })
			.done(function (html) {
				$box.html(html);
			})
			.fail(function () {
				$box.html('<p class="panel__empty">Не удалось загрузить сводку</p>');
			});
	});

	// «Показать ещё»: следующие отчёты сводки встают на место кнопки (с новой кнопкой, если отчёты ещё есть)
	$(document).on('click', '[data-load-more]', function () {
		var $button = $(this).prop('disabled', true);
		$.get($button.data('load-more'))
			.done(function (html) {
				$button.replaceWith(html);
			})
			.fail(function () {
				$button.prop('disabled', false);
			});
	});

	// Поиск по отчёту: прячем тесты без совпадений и пустые категории, найденное раскрываем
	$(document).on('input', '[data-report-search]', function () {
		var query = $(this).val().trim().toLowerCase();
		var found = 0;
		$('.report-category').each(function () {
			var $tests = $(this).find('.report-test');
			$tests.each(function () {
				var match = !query || $(this).text().toLowerCase().indexOf(query) !== -1;
				$(this).toggleClass('d-none', !match);
			});
			var visible = $tests.not('.d-none').length;
			found += visible;
			$(this).toggleClass('d-none', visible === 0);
			if (query && visible > 0) {
				bootstrap.Collapse.getOrCreateInstance($(this).find('.collapse')[0], { toggle: false }).show();
			}
		});
		$('[data-report-search-empty]').toggleClass('d-none', found > 0);
	});
});
