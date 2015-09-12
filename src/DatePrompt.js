var moment =		require('moment');
var bluebird =		require('bluebird');
var escapes =		require('ansi-escapes');
var lPad =			require('left-pad');
var chalk =			require('chalk');





module.exports = {



	digits: [
		{
			unit:		'day',
			method:		'day',
			length:		2,
			offset:		1,   // because Sunday is 0
			format:		'ddd'
		}, {
			unit:		'day',
			method:		'date',
			length:		2,
			format:		'DD'
		}, {
			unit:		'month',
			method:		'month',
			length:		2,
			offset:		1,   // because January is 0
			format:		'MMM'
		}, {
			unit:		'year',
			method:		'year',
			length:		4,
			format:		'YYYY'
		}, {
			unit:		'hour',
			method:		'hour',
			length:		2,
			format:		'HH',
			separator:	':'
		}, {
			unit:		'minute',
			method:		'minute',
			length:		2,
			format:		'mm',
			separator:	''
		}
	],



	_m:		null,   // moment.js object
	_i:		null,   // stdin
	_o:		null,   // stdout

	_df:	null,   // deferred
	date:	null,   // promise

	_d:		null,   // current index of `this.digits`
	_p:		null,   // temporary typed value
	_k:		null,   // key handler
	_l:		null,   // when a number key was pressed the last time



	init: function (question, options) {
		var self = this;
		options = options || {};

		if (!question || 'string' != typeof question)
			throw new Error('`question` must be a string.');

		this._q = question;
		this._m = options.date ? moment(options.date) : moment();
		this._i = options.stdin || process.stdin;
		this._o = options.stdout || process.stdout;

		// todo: let `DatePrompt` directly inherit from bluebird
		this._df = bluebird.defer();
		this.date = this._df.promise;

		this._d = 0;
		this._p = '';

		var _k = function (key) {
			key = key.toString('utf8');

			if(/\x1b\[+[A-Z]/.test(key)) {
				key = key.charAt(key.length - 1);
				if		(key === 'A')	return self.up();
				else if	(key === 'B')	return self.down();
				else if	(key === 'C')	return self.right();
				else if	(key === 'D')	return self.left();
				else if	(key === 'F')	return self.first();
				else if	(key === 'H')	return self.last();
			}

			else if	(key === '\u0003')	return self.abort();   // ctrl + C
			else if	(key === '\x1b')	return self.abort();   // escape
			else if	(key === '\r')		return self.submit();   // carriage return
			else if	(key === '\n')		return self.submit();   // newline
			else if	(key === '\t')		return self.right();   // tab

			else if	(/[0-9]/.test(key))	return self.number(parseInt(key));   // number key
			else if (key.length > 1)
				for (var i = 0; i < key.length; i++) _k(key[i]);
		};
		this._k = _k;
		this._i.on('data', _k);

		this._i.setRawMode(true);
		this._i.resume();
		this._o.write(escapes.cursorHide);

		this.render();
		return this;
	},



	abort: function () {
		this._df.reject();

		this._i.removeListener('data', this._k);
		this._i.setRawMode(false);
		this._i.pause();

		this._o.write(escapes.eraseLine + '\r' + escapes.cursorShow);
	},

	submit: function () {
		this._df.resolve(this._m);

		this._i.removeListener('data', this._k);
		this._i.setRawMode(false);
		this._i.pause();

		this.render(true);
		this._o.write('\r\n' + escapes.cursorShow);
	},



	// number key handling

	number: function (n) {
		var now = new Date();
		if ((now - this._l) > 1000)   // a lot of time elapsed
			this._p = '' + n;   // reset temporary value
		else {
			this._p += n;
			if (this._p.length >= this.digits[this._d].length) {   // got all digits
				var v = parseInt(this._p);
				v -= this.digits[this._d].offset || 0;
				this._m[this.digits[this._d].method](v);
				this._p = '';
				if (this._d < this.digits.length - 1) this._d++;
			}
		}
		this._l = now;
		this.render();
	},



	// arrow key handling

	first: function () {
		if (this._d != 0) this._p = '';
		this._d = 0;
		this.render();
	},
	right: function () {
		if (this._d != this.digits.length - 1) this._p = '';
		this._d = this.digits.length - 1;
		this.render();
	},

	left: function () {
		if (this._d > 0) {
			this._d--;
			this._p = '';
		} else this._o.write(escapes.beep);
		this.render();
	},
	right: function () {
		if (this._d < this.digits.length - 1) {
			this._d++;
			this._p = '';
		} else this._o.write(escapes.beep);
		this.render();
	},

	up: function () {
		this._m.add(1, this.digits[this._d].unit);
		this._p = '';
		this.render();
	},
	down: function () {
		this._m.subtract(1, this.digits[this._d].unit);
		this._p = '';
		this.render();
	},



	render: function (formatted) {
		this._o.write(escapes.eraseLine + '\r' + chalk.green(formatted ? '✔' : '?') + ' ');

		var i, digit;
		for (i = 0; i < this.digits.length; i++) {
			digit = this.digits[i];

			if (!formatted && i === this._d)
				this._o.write(chalk.cyan.underline(this._m.format(digit.format)));
			else this._o.write(this._m.format(digit.format));

			if ('string' === typeof digit.separator) this._o.write(digit.separator);
			else this._o.write(' ');
		}
	},



};
