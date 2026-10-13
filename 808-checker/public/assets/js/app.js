/* Поведение интерфейса: меню, пароль, запуск проверки и страница отчёта.
   Меню и показ пароля повторяют assets/js/app.js из 808 Utilities. */
$(function () {
	'use strict';

	// Подменю бокового меню: раскрыть / свернуть
	$(document).on('click', '.sidebar-menu .submenu > a', function (event) {
		event.preventDefault();
		$(this).toggleClass('subdrop');
		$(this).next('ul').stop(true, true).slideToggle(250);
	});

	// Свернуть меню до узкой полосы (на компьютере). Выбор запоминается в браузере,
	// а включается при загрузке в layouts/app.ejs.
	$(document).on('click', '[data-toggle-mini]', function (event) {
		event.preventDefault();
		$('body').toggleClass('mini-sidebar');
		try {
			localStorage.setItem('mini-sidebar', $('body').hasClass('mini-sidebar') ? '1' : '0');
		} catch (error) {}
	});

	// Мобильное меню: открыть кнопкой, закрыть по затемнению
	$(document).on('click', '[data-mobile-open]', function (event) {
		event.preventDefault();
		$('.main-wrapper').toggleClass('slide-nav');
	});
	$(document).on('click', '[data-mobile-close]', function () {
		$('.main-wrapper').removeClass('slide-nav');
	});

	// Показать / скрыть пароль
	$(document).on('click', '.toggle-password', function () {
		var $input = $(this).siblings('.pass-input');
		var show = $input.attr('type') === 'password';
		$input.attr('type', show ? 'text' : 'password');
		$(this).toggleClass('feather-eye-off', !show).toggleClass('feather-eye', show);
	});

	// Окно запуска проверки: подставляем сценарий из нажатой кнопки «Запустить»
	document.addEventListener('show.bs.modal', function (event) {
		if (event.target.id !== 'launch-modal' || !event.relatedTarget) return;
		var button = event.relatedTarget;
		$(event.target).find('[name="scenario_id"]').val(button.dataset.scenarioId);
		$(event.target).find('[data-launch-scenario-name]').text(button.dataset.scenarioName);
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
		$(this).parent().remove();
	});

	// Скриншот крупно в модальном окне
	$(document).on('click', '[data-media-preview]', function () {
		var $modal = $('#media-modal');
		$modal.find('[data-media-modal-image]').attr('src', $(this).data('media-preview'));
		$modal.find('[data-media-modal-caption]').text($(this).data('media-caption'));
		bootstrap.Modal.getOrCreateInstance($modal[0]).show();
	});

	// Поиск по отчёту: прячем тесты без совпадений и пустые категории
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
		});
		$('[data-report-search-empty]').toggleClass('d-none', found > 0);
	});
});
