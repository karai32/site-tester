/* Поведение интерфейса: меню и показ пароля.
   Повторяет assets/js/app.js из 808 Utilities. */
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
});
