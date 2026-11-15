$(function () {
	'use strict';

	$(document).on('click', '[data-submenu-toggle]', function () {
		var open = !$(this).hasClass('open');
		$(this).toggleClass('open', open).attr('aria-expanded', open);
		$(this).next('ul').prop('hidden', !open);
	});

	$(document).on('click', '[data-mobile-open]', function () {
		$('.app').addClass('menu-open');
	});
	$(document).on('click', '[data-mobile-close]', function () {
		$('.app').removeClass('menu-open');
	});

	$(document).on('click', '.toggle-password', function () {
		var $input = $(this).siblings('.pass-input');
		var show = $input.attr('type') === 'password';
		$input.attr('type', show ? 'text' : 'password');
		$(this).toggleClass('feather-eye-off', !show).toggleClass('feather-eye', show);
	});

	$('[data-login-form]').each(function () {
		var $form = $(this);
		var update = function () {
			var filled = $form.find('#login').val().trim() !== '' && $form.find('#password').val() !== '';
			$form.find('[type="submit"]').prop('disabled', !filled);
		};
		$form.on('input', update);
		update();
	});

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

	$(document).on('change', 'input[data-auto-submit]', function () {
		this.form.submit();
	});

	$(document).on('click', '[data-copy]', function () {
		var $button = $(this);
		navigator.clipboard.writeText($button.data('copy')).then(function () {
			$button.text('Скопировано');
		});
	});
	$(document).on('focus', '[data-select-on-focus]', function () {
		this.select();
	});

	$(document).on('submit', 'form[data-confirm]', function (event) {
		if (!window.confirm($(this).data('confirm'))) event.preventDefault();
	});

	var $autoRefresh = $('[data-auto-refresh]');
	if ($autoRefresh.length) {
		setTimeout(function () {
			window.location.reload();
		}, Number($autoRefresh.data('auto-refresh')) * 1000);
	}

	$(document).on('click', '[data-show-more]', function () {
		$(this).closest('.report-test').find('[data-more-item]').removeClass('d-none');
		$(this).remove();
	});

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
	$(document).on('hidden.bs.modal', '#media-modal', function () {
		$(this).find('[data-media-modal-body]').empty();
	});

	$(document).on('change', '[data-scenario-summary-select]', function () {
		var $box = $('[data-scenario-summary]');
		if (!this.value) {
			$box.empty();
			return;
		}
		$box.html('<p class="panel__empty">Загрузка...</p>');
		$.get($(this).data('url'), { scenario: this.value })
			.done(function (html) {
				$box.html(html);
			})
			.fail(function () {
				$box.html('<p class="panel__empty">Не удалось загрузить сводку</p>');
			});
	});

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

	$(document).on('click', '[data-open-section]', function () {
		var body = document.querySelector($(this).data('open-section'));
		bootstrap.Collapse.getOrCreateInstance(body, { toggle: false }).show();
	});

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
