$(function () {
	'use strict';

	$(document).on('click', '.sidebar-menu .submenu > a', function (event) {
		event.preventDefault();
		var $link = $(this);
		$link.toggleClass('subdrop');
		$link.next('ul').stop(true, true).slideToggle(250);
	});

	$(document).on('click', '[data-kit-toggle-mini]', function (event) {
		event.preventDefault();
		$(this).closest('[data-kit-app]').toggleClass('mini-sidebar');
	});

	$(document).on('click', '[data-kit-mobile-btn]', function (event) {
		event.preventDefault();
		$(this).closest('[data-kit-phone]').toggleClass('slide-nav');
	});
	$(document).on('click', '[data-kit-overlay]', function () {
		$(this).closest('[data-kit-phone]').removeClass('slide-nav');
	});

	$(document).on('click', '.toggle-password', function () {
		var $icon = $(this);
		var $input = $icon.siblings('.pass-input');
		var show = $input.attr('type') === 'password';
		$input.attr('type', show ? 'text' : 'password');
		$icon.toggleClass('feather-eye-off', !show).toggleClass('feather-eye', show);
	});

	if ($.fn.select2) {
		$('.select').select2({
			minimumResultsForSearch: -1,
			width: '100%'
		});
	}

	document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
		new bootstrap.Tooltip(el);
	});
	document.querySelectorAll('[data-bs-toggle="popover"]').forEach(function (el) {
		new bootstrap.Popover(el);
	});

	var toastTexts = {
		success: ['Логотип удалён', 'Для проекта Hadassah снова используется заглушка'],
		info: ['Проверка запущена', '«Полный аудит» займёт около 5 минут'],
		warning: ['Отложенная проверка', 'Запланирована на 10.09.2026, 09:00'],
		error: ['Проверка не выполнена', 'Сайт не ответил за 30 секунд']
	};
	$(document).on('click', '[data-kit-toast]', function () {
		var type = $(this).data('kit-toast');
		var text = toastTexts[type];
		if (window.toastr && text) {
			toastr[type](text[1], text[0], { closeButton: true, positionClass: 'toast-top-right', timeOut: 4000 });
		}
	});

	$(document).on('change', '.dropdown-menu .custom_check input', function () {
		var $dropdown = $(this).closest('.dropdown');
		var $button = $dropdown.find('[data-kit-check-label]');
		if (!$button.length) return;
		var $boxes = $dropdown.find('.custom_check input');
		var checked = $boxes.filter(':checked').length;
		var value = checked === $boxes.length ? 'Все' : String(checked);
		$button.text($button.data('kit-check-label') + ': ' + value);
	});

	$(document).on('click', '[data-kit-pagination] .page-link', function (event) {
		event.preventDefault();
		var $item = $(this).parent();
		if ($item.hasClass('previous') || $item.hasClass('next') || $item.hasClass('disabled') || !/^\d+$/.test($(this).text().trim())) return;
		$item.siblings().removeClass('active');
		$item.addClass('active');
	});

	$(document).on('click', '[data-kit-swatches] span:not(.theme-colors-add)', function () {
		$(this).closest('[data-kit-swatches]').find('span').removeClass('active');
		$(this).addClass('active');
	});

	$(document).on('change', '[data-kit-file]', function () {
		var hasFile = Boolean(this.files && this.files[0]);
		$(this).siblings('[data-kit-file-name]').text(hasFile ? this.files[0].name : 'Файл не выбран').toggleClass('has-file', hasFile);
		$(this).closest('.modal-body').find('.submit-form').prop('disabled', !hasFile);
	});

	$(document).on('click', '[data-kit-swap-modal]', function () {
		var current = bootstrap.Modal.getInstance(this.closest('.modal'));
		var next = document.querySelector(this.getAttribute('data-kit-swap-modal'));
		if (current) {
			this.closest('.modal').addEventListener('hidden.bs.modal', function () {
				bootstrap.Modal.getOrCreateInstance(next).show();
			}, { once: true });
			current.hide();
		}
	});

	$('[data-kit-circle]').each(function () {
		var value = Math.max(0, Math.min(100, parseFloat($(this).data('kit-circle')) || 0));
		var arc = this.querySelector('.kit-circle-arc');
		var length = 2 * Math.PI * 44;
		arc.setAttribute('stroke-dasharray', (length * value / 100).toFixed(2) + ' ' + length.toFixed(2));
	});

	$('[data-kit-auth]').each(function () {
		var form = this;
		var submit = form.querySelector('[type="submit"]');
		var error = form.querySelector('[data-kit-auth-error]');
		function update() {
			var filled = Array.prototype.every.call(form.querySelectorAll('input[required]'), function (input) {
				return input.type === 'checkbox' ? input.checked : input.value.trim() !== '';
			});
			submit.disabled = !filled;
		}
		form.addEventListener('input', update);
		form.addEventListener('change', update);
		form.addEventListener('submit', function (event) {
			event.preventDefault();
			error.classList.remove('d-none');
		});
		update();
	});

	$(document).on('click', 'a[href="#"]', function (event) {
		event.preventDefault();
	});
});
