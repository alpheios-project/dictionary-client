/**
 * Base Adapter Class for a Dictionary Service
 */
class BaseDictAdapter {
  /**
   * Lookup a short definition in a lexicon
   * @param {Lemma} lemma Lemma to lookup
   * @return {Definition} a Definition object
   */
  async lookupShortDef (lemma) {

  }

  /**
   * Lookup a full definition in a lexicon
   * @param {Lemma} lemma Lemma to lookup
   * @return {Promise} a Promise that resovles to a Definition object
   */
  async lookupFullDef (lemma) {

  }
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var papaparse = createCommonjsModule(function (module, exports) {
/*!
	Papa Parse
	v4.3.6
	https://github.com/mholt/PapaParse
	License: MIT
*/
(function(root, factory)
{
	if (typeof undefined === 'function' && undefined.amd)
	{
		// AMD. Register as an anonymous module.
		undefined([], factory);
	}
	else {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like environments that support module.exports,
		// like Node.
		module.exports = factory();
	}
}(this, function()
{
	'use strict';

	var global = (function () {
		// alternative method, similar to `Function('return this')()`
		// but without using `eval` (which is disabled when
		// using Content Security Policy).

		if (typeof self !== 'undefined') { return self; }
		if (typeof window !== 'undefined') { return window; }
		if (typeof global !== 'undefined') { return global; }

		// When running tests none of the above have been defined
		return {};
	})();


	var IS_WORKER = !global.document && !!global.postMessage,
		IS_PAPA_WORKER = IS_WORKER && /(\?|&)papaworker(=|&|$)/.test(global.location.search),
		LOADED_SYNC = false, AUTO_SCRIPT_PATH;
	var workers = {}, workerIdCounter = 0;

	var Papa = {};

	Papa.parse = CsvToJson;
	Papa.unparse = JsonToCsv;

	Papa.RECORD_SEP = String.fromCharCode(30);
	Papa.UNIT_SEP = String.fromCharCode(31);
	Papa.BYTE_ORDER_MARK = '\ufeff';
	Papa.BAD_DELIMITERS = ['\r', '\n', '"', Papa.BYTE_ORDER_MARK];
	Papa.WORKERS_SUPPORTED = !IS_WORKER && !!global.Worker;
	Papa.SCRIPT_PATH = null;	// Must be set by your code if you use workers and this lib is loaded asynchronously

	// Configurable chunk sizes for local and remote files, respectively
	Papa.LocalChunkSize = 1024 * 1024 * 10;	// 10 MB
	Papa.RemoteChunkSize = 1024 * 1024 * 5;	// 5 MB
	Papa.DefaultDelimiter = ',';			// Used if not specified and detection fails

	// Exposed for testing and development only
	Papa.Parser = Parser;
	Papa.ParserHandle = ParserHandle;
	Papa.NetworkStreamer = NetworkStreamer;
	Papa.FileStreamer = FileStreamer;
	Papa.StringStreamer = StringStreamer;
	Papa.ReadableStreamStreamer = ReadableStreamStreamer;

	if (global.jQuery)
	{
		var $ = global.jQuery;
		$.fn.parse = function(options)
		{
			var config = options.config || {};
			var queue = [];

			this.each(function(idx)
			{
				var supported = $(this).prop('tagName').toUpperCase() === 'INPUT'
								&& $(this).attr('type').toLowerCase() === 'file'
								&& global.FileReader;

				if (!supported || !this.files || this.files.length === 0)
					return true;	// continue to next input element

				for (var i = 0; i < this.files.length; i++)
				{
					queue.push({
						file: this.files[i],
						inputElem: this,
						instanceConfig: $.extend({}, config)
					});
				}
			});

			parseNextFile();	// begin parsing
			return this;		// maintains chainability


			function parseNextFile()
			{
				if (queue.length === 0)
				{
					if (isFunction(options.complete))
						options.complete();
					return;
				}

				var f = queue[0];

				if (isFunction(options.before))
				{
					var returned = options.before(f.file, f.inputElem);

					if (typeof returned === 'object')
					{
						if (returned.action === 'abort')
						{
							error('AbortError', f.file, f.inputElem, returned.reason);
							return;	// Aborts all queued files immediately
						}
						else if (returned.action === 'skip')
						{
							fileComplete();	// parse the next file in the queue, if any
							return;
						}
						else if (typeof returned.config === 'object')
							f.instanceConfig = $.extend(f.instanceConfig, returned.config);
					}
					else if (returned === 'skip')
					{
						fileComplete();	// parse the next file in the queue, if any
						return;
					}
				}

				// Wrap up the user's complete callback, if any, so that ours also gets executed
				var userCompleteFunc = f.instanceConfig.complete;
				f.instanceConfig.complete = function(results)
				{
					if (isFunction(userCompleteFunc))
						userCompleteFunc(results, f.file, f.inputElem);
					fileComplete();
				};

				Papa.parse(f.file, f.instanceConfig);
			}

			function error(name, file, elem, reason)
			{
				if (isFunction(options.error))
					options.error({name: name}, file, elem, reason);
			}

			function fileComplete()
			{
				queue.splice(0, 1);
				parseNextFile();
			}
		};
	}


	if (IS_PAPA_WORKER)
	{
		global.onmessage = workerThreadReceivedMessage;
	}
	else if (Papa.WORKERS_SUPPORTED)
	{
		AUTO_SCRIPT_PATH = getScriptPath();

		// Check if the script was loaded synchronously
		if (!document.body)
		{
			// Body doesn't exist yet, must be synchronous
			LOADED_SYNC = true;
		}
		else
		{
			document.addEventListener('DOMContentLoaded', function () {
				LOADED_SYNC = true;
			}, true);
		}
	}




	function CsvToJson(_input, _config)
	{
		_config = _config || {};
		var dynamicTyping = _config.dynamicTyping || false;
		if (isFunction(dynamicTyping)) {
			_config.dynamicTypingFunction = dynamicTyping;
			// Will be filled on first row call
			dynamicTyping = {};
		}
		_config.dynamicTyping = dynamicTyping;

		if (_config.worker && Papa.WORKERS_SUPPORTED)
		{
			var w = newWorker();

			w.userStep = _config.step;
			w.userChunk = _config.chunk;
			w.userComplete = _config.complete;
			w.userError = _config.error;

			_config.step = isFunction(_config.step);
			_config.chunk = isFunction(_config.chunk);
			_config.complete = isFunction(_config.complete);
			_config.error = isFunction(_config.error);
			delete _config.worker;	// prevent infinite loop

			w.postMessage({
				input: _input,
				config: _config,
				workerId: w.id
			});

			return;
		}

		var streamer = null;
		if (typeof _input === 'string')
		{
			if (_config.download)
				streamer = new NetworkStreamer(_config);
			else
				streamer = new StringStreamer(_config);
		}
		else if (_input.readable === true && isFunction(_input.read) && isFunction(_input.on))
		{
			streamer = new ReadableStreamStreamer(_config);
		}
		else if ((global.File && _input instanceof File) || _input instanceof Object)	// ...Safari. (see issue #106)
			streamer = new FileStreamer(_config);

		return streamer.stream(_input);
	}






	function JsonToCsv(_input, _config)
	{
		var _output = '';
		var _fields = [];

		// Default configuration

		/** whether to surround every datum with quotes */
		var _quotes = false;

		/** whether to write headers */
		var _writeHeader = true;

		/** delimiting character */
		var _delimiter = ',';

		/** newline character(s) */
		var _newline = '\r\n';

		/** quote character */
		var _quoteChar = '"';

		unpackConfig();

		var quoteCharRegex = new RegExp(_quoteChar, 'g');

		if (typeof _input === 'string')
			_input = JSON.parse(_input);

		if (_input instanceof Array)
		{
			if (!_input.length || _input[0] instanceof Array)
				return serialize(null, _input);
			else if (typeof _input[0] === 'object')
				return serialize(objectKeys(_input[0]), _input);
		}
		else if (typeof _input === 'object')
		{
			if (typeof _input.data === 'string')
				_input.data = JSON.parse(_input.data);

			if (_input.data instanceof Array)
			{
				if (!_input.fields)
					_input.fields =  _input.meta && _input.meta.fields;

				if (!_input.fields)
					_input.fields =  _input.data[0] instanceof Array
									? _input.fields
									: objectKeys(_input.data[0]);

				if (!(_input.data[0] instanceof Array) && typeof _input.data[0] !== 'object')
					_input.data = [_input.data];	// handles input like [1,2,3] or ['asdf']
			}

			return serialize(_input.fields || [], _input.data || []);
		}

		// Default (any valid paths should return before this)
		throw 'exception: Unable to serialize unrecognized input';


		function unpackConfig()
		{
			if (typeof _config !== 'object')
				return;

			if (typeof _config.delimiter === 'string'
				&& _config.delimiter.length === 1
				&& Papa.BAD_DELIMITERS.indexOf(_config.delimiter) === -1)
			{
				_delimiter = _config.delimiter;
			}

			if (typeof _config.quotes === 'boolean'
				|| _config.quotes instanceof Array)
				_quotes = _config.quotes;

			if (typeof _config.newline === 'string')
				_newline = _config.newline;

			if (typeof _config.quoteChar === 'string')
				_quoteChar = _config.quoteChar;

			if (typeof _config.header === 'boolean')
				_writeHeader = _config.header;
		}


		/** Turns an object's keys into an array */
		function objectKeys(obj)
		{
			if (typeof obj !== 'object')
				return [];
			var keys = [];
			for (var key in obj)
				keys.push(key);
			return keys;
		}

		/** The double for loop that iterates the data and writes out a CSV string including header row */
		function serialize(fields, data)
		{
			var csv = '';

			if (typeof fields === 'string')
				fields = JSON.parse(fields);
			if (typeof data === 'string')
				data = JSON.parse(data);

			var hasHeader = fields instanceof Array && fields.length > 0;
			var dataKeyedByField = !(data[0] instanceof Array);

			// If there a header row, write it first
			if (hasHeader && _writeHeader)
			{
				for (var i = 0; i < fields.length; i++)
				{
					if (i > 0)
						csv += _delimiter;
					csv += safe(fields[i], i);
				}
				if (data.length > 0)
					csv += _newline;
			}

			// Then write out the data
			for (var row = 0; row < data.length; row++)
			{
				var maxCol = hasHeader ? fields.length : data[row].length;

				for (var col = 0; col < maxCol; col++)
				{
					if (col > 0)
						csv += _delimiter;
					var colIdx = hasHeader && dataKeyedByField ? fields[col] : col;
					csv += safe(data[row][colIdx], col);
				}

				if (row < data.length - 1)
					csv += _newline;
			}

			return csv;
		}

		/** Encloses a value around quotes if needed (makes a value safe for CSV insertion) */
		function safe(str, col)
		{
			if (typeof str === 'undefined' || str === null)
				return '';

			str = str.toString().replace(quoteCharRegex, _quoteChar+_quoteChar);

			var needsQuotes = (typeof _quotes === 'boolean' && _quotes)
							|| (_quotes instanceof Array && _quotes[col])
							|| hasAny(str, Papa.BAD_DELIMITERS)
							|| str.indexOf(_delimiter) > -1
							|| str.charAt(0) === ' '
							|| str.charAt(str.length - 1) === ' ';

			return needsQuotes ? _quoteChar + str + _quoteChar : str;
		}

		function hasAny(str, substrings)
		{
			for (var i = 0; i < substrings.length; i++)
				if (str.indexOf(substrings[i]) > -1)
					return true;
			return false;
		}
	}

	/** ChunkStreamer is the base prototype for various streamer implementations. */
	function ChunkStreamer(config)
	{
		this._handle = null;
		this._paused = false;
		this._finished = false;
		this._input = null;
		this._baseIndex = 0;
		this._partialLine = '';
		this._rowCount = 0;
		this._start = 0;
		this._nextChunk = null;
		this.isFirstChunk = true;
		this._completeResults = {
			data: [],
			errors: [],
			meta: {}
		};
		replaceConfig.call(this, config);

		this.parseChunk = function(chunk)
		{
			// First chunk pre-processing
			if (this.isFirstChunk && isFunction(this._config.beforeFirstChunk))
			{
				var modifiedChunk = this._config.beforeFirstChunk(chunk);
				if (modifiedChunk !== undefined)
					chunk = modifiedChunk;
			}
			this.isFirstChunk = false;

			// Rejoin the line we likely just split in two by chunking the file
			var aggregate = this._partialLine + chunk;
			this._partialLine = '';

			var results = this._handle.parse(aggregate, this._baseIndex, !this._finished);

			if (this._handle.paused() || this._handle.aborted())
				return;

			var lastIndex = results.meta.cursor;

			if (!this._finished)
			{
				this._partialLine = aggregate.substring(lastIndex - this._baseIndex);
				this._baseIndex = lastIndex;
			}

			if (results && results.data)
				this._rowCount += results.data.length;

			var finishedIncludingPreview = this._finished || (this._config.preview && this._rowCount >= this._config.preview);

			if (IS_PAPA_WORKER)
			{
				global.postMessage({
					results: results,
					workerId: Papa.WORKER_ID,
					finished: finishedIncludingPreview
				});
			}
			else if (isFunction(this._config.chunk))
			{
				this._config.chunk(results, this._handle);
				if (this._paused)
					return;
				results = undefined;
				this._completeResults = undefined;
			}

			if (!this._config.step && !this._config.chunk) {
				this._completeResults.data = this._completeResults.data.concat(results.data);
				this._completeResults.errors = this._completeResults.errors.concat(results.errors);
				this._completeResults.meta = results.meta;
			}

			if (finishedIncludingPreview && isFunction(this._config.complete) && (!results || !results.meta.aborted))
				this._config.complete(this._completeResults, this._input);

			if (!finishedIncludingPreview && (!results || !results.meta.paused))
				this._nextChunk();

			return results;
		};

		this._sendError = function(error)
		{
			if (isFunction(this._config.error))
				this._config.error(error);
			else if (IS_PAPA_WORKER && this._config.error)
			{
				global.postMessage({
					workerId: Papa.WORKER_ID,
					error: error,
					finished: false
				});
			}
		};

		function replaceConfig(config)
		{
			// Deep-copy the config so we can edit it
			var configCopy = copy(config);
			configCopy.chunkSize = parseInt(configCopy.chunkSize);	// parseInt VERY important so we don't concatenate strings!
			if (!config.step && !config.chunk)
				configCopy.chunkSize = null;  // disable Range header if not streaming; bad values break IIS - see issue #196
			this._handle = new ParserHandle(configCopy);
			this._handle.streamer = this;
			this._config = configCopy;	// persist the copy to the caller
		}
	}


	function NetworkStreamer(config)
	{
		config = config || {};
		if (!config.chunkSize)
			config.chunkSize = Papa.RemoteChunkSize;
		ChunkStreamer.call(this, config);

		var xhr;

		if (IS_WORKER)
		{
			this._nextChunk = function()
			{
				this._readChunk();
				this._chunkLoaded();
			};
		}
		else
		{
			this._nextChunk = function()
			{
				this._readChunk();
			};
		}

		this.stream = function(url)
		{
			this._input = url;
			this._nextChunk();	// Starts streaming
		};

		this._readChunk = function()
		{
			if (this._finished)
			{
				this._chunkLoaded();
				return;
			}

			xhr = new XMLHttpRequest();

			if (this._config.withCredentials)
			{
				xhr.withCredentials = this._config.withCredentials;
			}

			if (!IS_WORKER)
			{
				xhr.onload = bindFunction(this._chunkLoaded, this);
				xhr.onerror = bindFunction(this._chunkError, this);
			}

			xhr.open('GET', this._input, !IS_WORKER);
			// Headers can only be set when once the request state is OPENED
			if (this._config.downloadRequestHeaders)
			{
				var headers = this._config.downloadRequestHeaders;

				for (var headerName in headers)
				{
					xhr.setRequestHeader(headerName, headers[headerName]);
				}
			}

			if (this._config.chunkSize)
			{
				var end = this._start + this._config.chunkSize - 1;	// minus one because byte range is inclusive
				xhr.setRequestHeader('Range', 'bytes='+this._start+'-'+end);
				xhr.setRequestHeader('If-None-Match', 'webkit-no-cache'); // https://bugs.webkit.org/show_bug.cgi?id=82672
			}

			try {
				xhr.send();
			}
			catch (err) {
				this._chunkError(err.message);
			}

			if (IS_WORKER && xhr.status === 0)
				this._chunkError();
			else
				this._start += this._config.chunkSize;
		};

		this._chunkLoaded = function()
		{
			if (xhr.readyState != 4)
				return;

			if (xhr.status < 200 || xhr.status >= 400)
			{
				this._chunkError();
				return;
			}

			this._finished = !this._config.chunkSize || this._start > getFileSize(xhr);
			this.parseChunk(xhr.responseText);
		};

		this._chunkError = function(errorMessage)
		{
			var errorText = xhr.statusText || errorMessage;
			this._sendError(errorText);
		};

		function getFileSize(xhr)
		{
			var contentRange = xhr.getResponseHeader('Content-Range');
			if (contentRange === null) { // no content range, then finish!
					return -1;
					}
			return parseInt(contentRange.substr(contentRange.lastIndexOf('/') + 1));
		}
	}
	NetworkStreamer.prototype = Object.create(ChunkStreamer.prototype);
	NetworkStreamer.prototype.constructor = NetworkStreamer;


	function FileStreamer(config)
	{
		config = config || {};
		if (!config.chunkSize)
			config.chunkSize = Papa.LocalChunkSize;
		ChunkStreamer.call(this, config);

		var reader, slice;

		// FileReader is better than FileReaderSync (even in worker) - see http://stackoverflow.com/q/24708649/1048862
		// But Firefox is a pill, too - see issue #76: https://github.com/mholt/PapaParse/issues/76
		var usingAsyncReader = typeof FileReader !== 'undefined';	// Safari doesn't consider it a function - see issue #105

		this.stream = function(file)
		{
			this._input = file;
			slice = file.slice || file.webkitSlice || file.mozSlice;

			if (usingAsyncReader)
			{
				reader = new FileReader();		// Preferred method of reading files, even in workers
				reader.onload = bindFunction(this._chunkLoaded, this);
				reader.onerror = bindFunction(this._chunkError, this);
			}
			else
				reader = new FileReaderSync();	// Hack for running in a web worker in Firefox

			this._nextChunk();	// Starts streaming
		};

		this._nextChunk = function()
		{
			if (!this._finished && (!this._config.preview || this._rowCount < this._config.preview))
				this._readChunk();
		};

		this._readChunk = function()
		{
			var input = this._input;
			if (this._config.chunkSize)
			{
				var end = Math.min(this._start + this._config.chunkSize, this._input.size);
				input = slice.call(input, this._start, end);
			}
			var txt = reader.readAsText(input, this._config.encoding);
			if (!usingAsyncReader)
				this._chunkLoaded({ target: { result: txt } });	// mimic the async signature
		};

		this._chunkLoaded = function(event)
		{
			// Very important to increment start each time before handling results
			this._start += this._config.chunkSize;
			this._finished = !this._config.chunkSize || this._start >= this._input.size;
			this.parseChunk(event.target.result);
		};

		this._chunkError = function()
		{
			this._sendError(reader.error);
		};

	}
	FileStreamer.prototype = Object.create(ChunkStreamer.prototype);
	FileStreamer.prototype.constructor = FileStreamer;


	function StringStreamer(config)
	{
		config = config || {};
		ChunkStreamer.call(this, config);

		var string;
		var remaining;
		this.stream = function(s)
		{
			string = s;
			remaining = s;
			return this._nextChunk();
		};
		this._nextChunk = function()
		{
			if (this._finished) return;
			var size = this._config.chunkSize;
			var chunk = size ? remaining.substr(0, size) : remaining;
			remaining = size ? remaining.substr(size) : '';
			this._finished = !remaining;
			return this.parseChunk(chunk);
		};
	}
	StringStreamer.prototype = Object.create(StringStreamer.prototype);
	StringStreamer.prototype.constructor = StringStreamer;


	function ReadableStreamStreamer(config)
	{
		config = config || {};

		ChunkStreamer.call(this, config);

		var queue = [];
		var parseOnData = true;

		this.stream = function(stream)
		{
			this._input = stream;

			this._input.on('data', this._streamData);
			this._input.on('end', this._streamEnd);
			this._input.on('error', this._streamError);
		};

		this._nextChunk = function()
		{
			if (queue.length)
			{
				this.parseChunk(queue.shift());
			}
			else
			{
				parseOnData = true;
			}
		};

		this._streamData = bindFunction(function(chunk)
		{
			try
			{
				queue.push(typeof chunk === 'string' ? chunk : chunk.toString(this._config.encoding));

				if (parseOnData)
				{
					parseOnData = false;
					this.parseChunk(queue.shift());
				}
			}
			catch (error)
			{
				this._streamError(error);
			}
		}, this);

		this._streamError = bindFunction(function(error)
		{
			this._streamCleanUp();
			this._sendError(error.message);
		}, this);

		this._streamEnd = bindFunction(function()
		{
			this._streamCleanUp();
			this._finished = true;
			this._streamData('');
		}, this);

		this._streamCleanUp = bindFunction(function()
		{
			this._input.removeListener('data', this._streamData);
			this._input.removeListener('end', this._streamEnd);
			this._input.removeListener('error', this._streamError);
		}, this);
	}
	ReadableStreamStreamer.prototype = Object.create(ChunkStreamer.prototype);
	ReadableStreamStreamer.prototype.constructor = ReadableStreamStreamer;


	// Use one ParserHandle per entire CSV file or string
	function ParserHandle(_config)
	{
		// One goal is to minimize the use of regular expressions...
		var FLOAT = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i;

		var self = this;
		var _stepCounter = 0;	// Number of times step was called (number of rows parsed)
		var _input;				// The input being parsed
		var _parser;			// The core parser being used
		var _paused = false;	// Whether we are paused or not
		var _aborted = false;	// Whether the parser has aborted or not
		var _delimiterError;	// Temporary state between delimiter detection and processing results
		var _fields = [];		// Fields are from the header row of the input, if there is one
		var _results = {		// The last results returned from the parser
			data: [],
			errors: [],
			meta: {}
		};

		if (isFunction(_config.step))
		{
			var userStep = _config.step;
			_config.step = function(results)
			{
				_results = results;

				if (needsHeaderRow())
					processResults();
				else	// only call user's step function after header row
				{
					processResults();

					// It's possbile that this line was empty and there's no row here after all
					if (_results.data.length === 0)
						return;

					_stepCounter += results.data.length;
					if (_config.preview && _stepCounter > _config.preview)
						_parser.abort();
					else
						userStep(_results, self);
				}
			};
		}

		/**
		 * Parses input. Most users won't need, and shouldn't mess with, the baseIndex
		 * and ignoreLastRow parameters. They are used by streamers (wrapper functions)
		 * when an input comes in multiple chunks, like from a file.
		 */
		this.parse = function(input, baseIndex, ignoreLastRow)
		{
			if (!_config.newline)
				_config.newline = guessLineEndings(input);

			_delimiterError = false;
			if (!_config.delimiter)
			{
				var delimGuess = guessDelimiter(input, _config.newline, _config.skipEmptyLines);
				if (delimGuess.successful)
					_config.delimiter = delimGuess.bestDelimiter;
				else
				{
					_delimiterError = true;	// add error after parsing (otherwise it would be overwritten)
					_config.delimiter = Papa.DefaultDelimiter;
				}
				_results.meta.delimiter = _config.delimiter;
			}
			else if(isFunction(_config.delimiter))
			{
				_config.delimiter = _config.delimiter(input);
				_results.meta.delimiter = _config.delimiter;
			}

			var parserConfig = copy(_config);
			if (_config.preview && _config.header)
				parserConfig.preview++;	// to compensate for header row

			_input = input;
			_parser = new Parser(parserConfig);
			_results = _parser.parse(_input, baseIndex, ignoreLastRow);
			processResults();
			return _paused ? { meta: { paused: true } } : (_results || { meta: { paused: false } });
		};

		this.paused = function()
		{
			return _paused;
		};

		this.pause = function()
		{
			_paused = true;
			_parser.abort();
			_input = _input.substr(_parser.getCharIndex());
		};

		this.resume = function()
		{
			_paused = false;
			self.streamer.parseChunk(_input);
		};

		this.aborted = function ()
		{
			return _aborted;
		};

		this.abort = function()
		{
			_aborted = true;
			_parser.abort();
			_results.meta.aborted = true;
			if (isFunction(_config.complete))
				_config.complete(_results);
			_input = '';
		};

		function processResults()
		{
			if (_results && _delimiterError)
			{
				addError('Delimiter', 'UndetectableDelimiter', 'Unable to auto-detect delimiting character; defaulted to \''+Papa.DefaultDelimiter+'\'');
				_delimiterError = false;
			}

			if (_config.skipEmptyLines)
			{
				for (var i = 0; i < _results.data.length; i++)
					if (_results.data[i].length === 1 && _results.data[i][0] === '')
						_results.data.splice(i--, 1);
			}

			if (needsHeaderRow())
				fillHeaderFields();

			return applyHeaderAndDynamicTyping();
		}

		function needsHeaderRow()
		{
			return _config.header && _fields.length === 0;
		}

		function fillHeaderFields()
		{
			if (!_results)
				return;
			for (var i = 0; needsHeaderRow() && i < _results.data.length; i++)
				for (var j = 0; j < _results.data[i].length; j++)
					_fields.push(_results.data[i][j]);
			_results.data.splice(0, 1);
		}

		function shouldApplyDynamicTyping(field) {
			// Cache function values to avoid calling it for each row
			if (_config.dynamicTypingFunction && _config.dynamicTyping[field] === undefined) {
				_config.dynamicTyping[field] = _config.dynamicTypingFunction(field);
			}
			return (_config.dynamicTyping[field] || _config.dynamicTyping) === true
		}

		function parseDynamic(field, value)
		{
			if (shouldApplyDynamicTyping(field))
			{
				if (value === 'true' || value === 'TRUE')
					return true;
				else if (value === 'false' || value === 'FALSE')
					return false;
				else
					return tryParseFloat(value);
			}
			return value;
		}

		function applyHeaderAndDynamicTyping()
		{
			if (!_results || (!_config.header && !_config.dynamicTyping))
				return _results;

			for (var i = 0; i < _results.data.length; i++)
			{
				var row = _config.header ? {} : [];

				for (var j = 0; j < _results.data[i].length; j++)
				{
					var field = j;
					var value = _results.data[i][j];

					if (_config.header)
						field = j >= _fields.length ? '__parsed_extra' : _fields[j];

					value = parseDynamic(field, value);

					if (field === '__parsed_extra')
					{
						row[field] = row[field] || [];
						row[field].push(value);
					}
					else
						row[field] = value;
				}

				_results.data[i] = row;

				if (_config.header)
				{
					if (j > _fields.length)
						addError('FieldMismatch', 'TooManyFields', 'Too many fields: expected ' + _fields.length + ' fields but parsed ' + j, i);
					else if (j < _fields.length)
						addError('FieldMismatch', 'TooFewFields', 'Too few fields: expected ' + _fields.length + ' fields but parsed ' + j, i);
				}
			}

			if (_config.header && _results.meta)
				_results.meta.fields = _fields;
			return _results;
		}

		function guessDelimiter(input, newline, skipEmptyLines)
		{
			var delimChoices = [',', '\t', '|', ';', Papa.RECORD_SEP, Papa.UNIT_SEP];
			var bestDelim, bestDelta, fieldCountPrevRow;

			for (var i = 0; i < delimChoices.length; i++)
			{
				var delim = delimChoices[i];
				var delta = 0, avgFieldCount = 0, emptyLinesCount = 0;
				fieldCountPrevRow = undefined;

				var preview = new Parser({
					delimiter: delim,
					newline: newline,
					preview: 10
				}).parse(input);

				for (var j = 0; j < preview.data.length; j++)
				{
					if (skipEmptyLines && preview.data[j].length === 1 && preview.data[j][0].length === 0) {
						emptyLinesCount++;
						continue
					}
					var fieldCount = preview.data[j].length;
					avgFieldCount += fieldCount;

					if (typeof fieldCountPrevRow === 'undefined')
					{
						fieldCountPrevRow = fieldCount;
						continue;
					}
					else if (fieldCount > 1)
					{
						delta += Math.abs(fieldCount - fieldCountPrevRow);
						fieldCountPrevRow = fieldCount;
					}
				}

				if (preview.data.length > 0)
					avgFieldCount /= (preview.data.length - emptyLinesCount);

				if ((typeof bestDelta === 'undefined' || delta < bestDelta)
					&& avgFieldCount > 1.99)
				{
					bestDelta = delta;
					bestDelim = delim;
				}
			}

			_config.delimiter = bestDelim;

			return {
				successful: !!bestDelim,
				bestDelimiter: bestDelim
			}
		}

		function guessLineEndings(input)
		{
			input = input.substr(0, 1024*1024);	// max length 1 MB

			var r = input.split('\r');

			var n = input.split('\n');

			var nAppearsFirst = (n.length > 1 && n[0].length < r[0].length);

			if (r.length === 1 || nAppearsFirst)
				return '\n';

			var numWithN = 0;
			for (var i = 0; i < r.length; i++)
			{
				if (r[i][0] === '\n')
					numWithN++;
			}

			return numWithN >= r.length / 2 ? '\r\n' : '\r';
		}

		function tryParseFloat(val)
		{
			var isNumber = FLOAT.test(val);
			return isNumber ? parseFloat(val) : val;
		}

		function addError(type, code, msg, row)
		{
			_results.errors.push({
				type: type,
				code: code,
				message: msg,
				row: row
			});
		}
	}





	/** The core parser implements speedy and correct CSV parsing */
	function Parser(config)
	{
		// Unpack the config object
		config = config || {};
		var delim = config.delimiter;
		var newline = config.newline;
		var comments = config.comments;
		var step = config.step;
		var preview = config.preview;
		var fastMode = config.fastMode;
		var quoteChar = config.quoteChar || '"';

		// Delimiter must be valid
		if (typeof delim !== 'string'
			|| Papa.BAD_DELIMITERS.indexOf(delim) > -1)
			delim = ',';

		// Comment character must be valid
		if (comments === delim)
			throw 'Comment character same as delimiter';
		else if (comments === true)
			comments = '#';
		else if (typeof comments !== 'string'
			|| Papa.BAD_DELIMITERS.indexOf(comments) > -1)
			comments = false;

		// Newline must be valid: \r, \n, or \r\n
		if (newline != '\n' && newline != '\r' && newline != '\r\n')
			newline = '\n';

		// We're gonna need these at the Parser scope
		var cursor = 0;
		var aborted = false;

		this.parse = function(input, baseIndex, ignoreLastRow)
		{
			// For some reason, in Chrome, this speeds things up (!?)
			if (typeof input !== 'string')
				throw 'Input must be a string';

			// We don't need to compute some of these every time parse() is called,
			// but having them in a more local scope seems to perform better
			var inputLen = input.length,
				delimLen = delim.length,
				newlineLen = newline.length,
				commentsLen = comments.length;
			var stepIsFunction = isFunction(step);

			// Establish starting state
			cursor = 0;
			var data = [], errors = [], row = [], lastCursor = 0;

			if (!input)
				return returnable();

			if (fastMode || (fastMode !== false && input.indexOf(quoteChar) === -1))
			{
				var rows = input.split(newline);
				for (var i = 0; i < rows.length; i++)
				{
					var row = rows[i];
					cursor += row.length;
					if (i !== rows.length - 1)
						cursor += newline.length;
					else if (ignoreLastRow)
						return returnable();
					if (comments && row.substr(0, commentsLen) === comments)
						continue;
					if (stepIsFunction)
					{
						data = [];
						pushRow(row.split(delim));
						doStep();
						if (aborted)
							return returnable();
					}
					else
						pushRow(row.split(delim));
					if (preview && i >= preview)
					{
						data = data.slice(0, preview);
						return returnable(true);
					}
				}
				return returnable();
			}

			var nextDelim = input.indexOf(delim, cursor);
			var nextNewline = input.indexOf(newline, cursor);
			var quoteCharRegex = new RegExp(quoteChar+quoteChar, 'g');

			// Parser loop
			for (;;)
			{
				// Field has opening quote
				if (input[cursor] === quoteChar)
				{
					// Start our search for the closing quote where the cursor is
					var quoteSearch = cursor;

					// Skip the opening quote
					cursor++;

					for (;;)
					{
						// Find closing quote
						var quoteSearch = input.indexOf(quoteChar, quoteSearch+1);

						//No other quotes are found - no other delimiters
						if (quoteSearch === -1)
						{
							if (!ignoreLastRow) {
								// No closing quote... what a pity
								errors.push({
									type: 'Quotes',
									code: 'MissingQuotes',
									message: 'Quoted field unterminated',
									row: data.length,	// row has yet to be inserted
									index: cursor
								});
							}
							return finish();
						}

						// Closing quote at EOF
						if (quoteSearch === inputLen-1)
						{
							var value = input.substring(cursor, quoteSearch).replace(quoteCharRegex, quoteChar);
							return finish(value);
						}

						// If this quote is escaped, it's part of the data; skip it
						if (input[quoteSearch+1] === quoteChar)
						{
							quoteSearch++;
							continue;
						}

						// Closing quote followed by delimiter
						if (input[quoteSearch+1] === delim)
						{
							row.push(input.substring(cursor, quoteSearch).replace(quoteCharRegex, quoteChar));
							cursor = quoteSearch + 1 + delimLen;
							nextDelim = input.indexOf(delim, cursor);
							nextNewline = input.indexOf(newline, cursor);
							break;
						}

						// Closing quote followed by newline
						if (input.substr(quoteSearch+1, newlineLen) === newline)
						{
							row.push(input.substring(cursor, quoteSearch).replace(quoteCharRegex, quoteChar));
							saveRow(quoteSearch + 1 + newlineLen);
							nextDelim = input.indexOf(delim, cursor);	// because we may have skipped the nextDelim in the quoted field

							if (stepIsFunction)
							{
								doStep();
								if (aborted)
									return returnable();
							}

							if (preview && data.length >= preview)
								return returnable(true);

							break;
						}


						// Checks for valid closing quotes are complete (escaped quotes or quote followed by EOF/delimiter/newline) -- assume these quotes are part of an invalid text string
						errors.push({
							type: 'Quotes',
							code: 'InvalidQuotes',
							message: 'Trailing quote on quoted field is malformed',
							row: data.length,	// row has yet to be inserted
							index: cursor
						});

						quoteSearch++;
						continue;

					}

					continue;
				}

				// Comment found at start of new line
				if (comments && row.length === 0 && input.substr(cursor, commentsLen) === comments)
				{
					if (nextNewline === -1)	// Comment ends at EOF
						return returnable();
					cursor = nextNewline + newlineLen;
					nextNewline = input.indexOf(newline, cursor);
					nextDelim = input.indexOf(delim, cursor);
					continue;
				}

				// Next delimiter comes before next newline, so we've reached end of field
				if (nextDelim !== -1 && (nextDelim < nextNewline || nextNewline === -1))
				{
					row.push(input.substring(cursor, nextDelim));
					cursor = nextDelim + delimLen;
					nextDelim = input.indexOf(delim, cursor);
					continue;
				}

				// End of row
				if (nextNewline !== -1)
				{
					row.push(input.substring(cursor, nextNewline));
					saveRow(nextNewline + newlineLen);

					if (stepIsFunction)
					{
						doStep();
						if (aborted)
							return returnable();
					}

					if (preview && data.length >= preview)
						return returnable(true);

					continue;
				}

				break;
			}


			return finish();


			function pushRow(row)
			{
				data.push(row);
				lastCursor = cursor;
			}

			/**
			 * Appends the remaining input from cursor to the end into
			 * row, saves the row, calls step, and returns the results.
			 */
			function finish(value)
			{
				if (ignoreLastRow)
					return returnable();
				if (typeof value === 'undefined')
					value = input.substr(cursor);
				row.push(value);
				cursor = inputLen;	// important in case parsing is paused
				pushRow(row);
				if (stepIsFunction)
					doStep();
				return returnable();
			}

			/**
			 * Appends the current row to the results. It sets the cursor
			 * to newCursor and finds the nextNewline. The caller should
			 * take care to execute user's step function and check for
			 * preview and end parsing if necessary.
			 */
			function saveRow(newCursor)
			{
				cursor = newCursor;
				pushRow(row);
				row = [];
				nextNewline = input.indexOf(newline, cursor);
			}

			/** Returns an object with the results, errors, and meta. */
			function returnable(stopped)
			{
				return {
					data: data,
					errors: errors,
					meta: {
						delimiter: delim,
						linebreak: newline,
						aborted: aborted,
						truncated: !!stopped,
						cursor: lastCursor + (baseIndex || 0)
					}
				};
			}

			/** Executes the user's step function and resets data & errors. */
			function doStep()
			{
				step(returnable());
				data = [], errors = [];
			}
		};

		/** Sets the abort flag */
		this.abort = function()
		{
			aborted = true;
		};

		/** Gets the cursor position */
		this.getCharIndex = function()
		{
			return cursor;
		};
	}


	// If you need to load Papa Parse asynchronously and you also need worker threads, hard-code
	// the script path here. See: https://github.com/mholt/PapaParse/issues/87#issuecomment-57885358
	function getScriptPath()
	{
		var scripts = document.getElementsByTagName('script');
		return scripts.length ? scripts[scripts.length - 1].src : '';
	}

	function newWorker()
	{
		if (!Papa.WORKERS_SUPPORTED)
			return false;
		if (!LOADED_SYNC && Papa.SCRIPT_PATH === null)
			throw new Error(
				'Script path cannot be determined automatically when Papa Parse is loaded asynchronously. ' +
				'You need to set Papa.SCRIPT_PATH manually.'
			);
		var workerUrl = Papa.SCRIPT_PATH || AUTO_SCRIPT_PATH;
		// Append 'papaworker' to the search string to tell papaparse that this is our worker.
		workerUrl += (workerUrl.indexOf('?') !== -1 ? '&' : '?') + 'papaworker';
		var w = new global.Worker(workerUrl);
		w.onmessage = mainThreadReceivedMessage;
		w.id = workerIdCounter++;
		workers[w.id] = w;
		return w;
	}

	/** Callback when main thread receives a message */
	function mainThreadReceivedMessage(e)
	{
		var msg = e.data;
		var worker = workers[msg.workerId];
		var aborted = false;

		if (msg.error)
			worker.userError(msg.error, msg.file);
		else if (msg.results && msg.results.data)
		{
			var abort = function() {
				aborted = true;
				completeWorker(msg.workerId, { data: [], errors: [], meta: { aborted: true } });
			};

			var handle = {
				abort: abort,
				pause: notImplemented,
				resume: notImplemented
			};

			if (isFunction(worker.userStep))
			{
				for (var i = 0; i < msg.results.data.length; i++)
				{
					worker.userStep({
						data: [msg.results.data[i]],
						errors: msg.results.errors,
						meta: msg.results.meta
					}, handle);
					if (aborted)
						break;
				}
				delete msg.results;	// free memory ASAP
			}
			else if (isFunction(worker.userChunk))
			{
				worker.userChunk(msg.results, handle, msg.file);
				delete msg.results;
			}
		}

		if (msg.finished && !aborted)
			completeWorker(msg.workerId, msg.results);
	}

	function completeWorker(workerId, results) {
		var worker = workers[workerId];
		if (isFunction(worker.userComplete))
			worker.userComplete(results);
		worker.terminate();
		delete workers[workerId];
	}

	function notImplemented() {
		throw 'Not implemented.';
	}

	/** Callback when worker thread receives a message */
	function workerThreadReceivedMessage(e)
	{
		var msg = e.data;

		if (typeof Papa.WORKER_ID === 'undefined' && msg)
			Papa.WORKER_ID = msg.workerId;

		if (typeof msg.input === 'string')
		{
			global.postMessage({
				workerId: Papa.WORKER_ID,
				results: Papa.parse(msg.input, msg.config),
				finished: true
			});
		}
		else if ((global.File && msg.input instanceof File) || msg.input instanceof Object)	// thank you, Safari (see issue #106)
		{
			var results = Papa.parse(msg.input, msg.config);
			if (results)
				global.postMessage({
					workerId: Papa.WORKER_ID,
					results: results,
					finished: true
				});
		}
	}

	/** Makes a deep copy of an array or object (mostly) */
	function copy(obj)
	{
		if (typeof obj !== 'object')
			return obj;
		var cpy = obj instanceof Array ? [] : {};
		for (var key in obj)
			cpy[key] = copy(obj[key]);
		return cpy;
	}

	function bindFunction(f, self)
	{
		return function() { f.apply(self, arguments); };
	}

	function isFunction(func)
	{
		return typeof func === 'function';
	}

	return Papa;
}));
});

/* eslint-disable no-unused-vars */
const LANG_UNIT_WORD = Symbol('word');
const LANG_UNIT_CHAR = Symbol('char');
const LANG_DIR_LTR = Symbol('ltr');
const LANG_DIR_RTL = Symbol('rtl');
const LANG_LATIN = Symbol('latin');
const LANG_GREEK = Symbol('greek');
const LANG_ARABIC = Symbol('arabic');
const LANG_PERSIAN = Symbol('persian');
const STR_LANG_CODE_LAT = 'lat';
const STR_LANG_CODE_LA = 'la';
const STR_LANG_CODE_GRC = 'grc';
const STR_LANG_CODE_ARA = 'ara';
const STR_LANG_CODE_AR = 'ar';
const STR_LANG_CODE_FAR = 'far';
const STR_LANG_CODE_PER = 'per';
// parts of speech
const POFS_ADJECTIVE = 'adjective';
const POFS_ADVERB = 'adverb';
const POFS_ADVERBIAL = 'adverbial';
const POFS_ARTICLE = 'article';
const POFS_CONJUNCTION = 'conjunction';
const POFS_EXCLAMATION = 'exclamation';
const POFS_INTERJECTION = 'interjection';
const POFS_NOUN = 'noun';
const POFS_NUMERAL = 'numeral';
const POFS_PARTICLE = 'particle';
const POFS_PREFIX = 'prefix';
const POFS_PREPOSITION = 'preposition';
const POFS_PRONOUN = 'pronoun';
const POFS_SUFFIX = 'suffix';
const POFS_SUPINE = 'supine';
const POFS_VERB = 'verb';
const POFS_VERB_PARTICIPLE = 'verb participle';
// gender
const GEND_MASCULINE = 'masculine';
const GEND_FEMININE = 'feminine';
const GEND_NEUTER = 'neuter';
const GEND_COMMON = 'common';
const GEND_ANIMATE = 'animate';
const GEND_INANIMATE = 'inanimate';
// Polish gender types
const GEND_PERSONAL_MASCULINE = 'personal masculine';
const GEND_ANIMATE_MASCULINE = 'animate masculine';
const GEND_INANIMATE_MASCULINE = 'inanimate masculine';
// comparative
const COMP_POSITIVE = 'positive';
const COMP_COMPARITIVE = 'comparative';
const COMP_SUPERLATIVE = 'superlative';
// case
const CASE_ABESSIVE = 'abessive';
const CASE_ABLATIVE = 'ablative';
const CASE_ABSOLUTIVE = 'absolutive';
const CASE_ACCUSATIVE = 'accusative';
const CASE_ADDIRECTIVE = 'addirective';
const CASE_ADELATIVE = 'adelative';
const CASE_ADESSIVE = 'adessive';
const CASE_ADVERBIAL = 'adverbial';
const CASE_ALLATIVE = 'allative';
const CASE_ANTESSIVE = 'antessive';
const CASE_APUDESSIVE = 'apudessive';
const CASE_AVERSIVE = 'aversive';
const CASE_BENEFACTIVE = 'benefactive';
const CASE_CARITIVE = 'caritive';
const CASE_CAUSAL = 'causal';
const CASE_CAUSAL_FINAL = 'causal-final';
const CASE_COMITATIVE = 'comitative';
const CASE_DATIVE = 'dative';
const CASE_DELATIVE = 'delative';
const CASE_DIRECT = 'direct';
const CASE_DISTRIBUTIVE = 'distributive';
const CASE_DISTRIBUTIVE_TEMPORAL = 'distributive-temporal';
const CASE_ELATIVE = 'elative';
const CASE_ERGATIVE = 'ergative';
const CASE_ESSIVE = 'essive';
const CASE_ESSIVE_FORMAL = 'essive-formal';
const CASE_ESSIVE_MODAL = 'essive-modal';
const CASE_EQUATIVE = 'equative';
const CASE_EVITATIVE = 'evitative';
const CASE_EXESSIVE = 'exessive';
const CASE_FINAL = 'final';
const CASE_FORMAL = 'formal';
const CASE_GENITIVE = 'genitive';
const CASE_ILLATIVE = 'illative';
const CASE_INELATIVE = 'inelative';
const CASE_INESSIVE = 'inessive';
const CASE_INSTRUCTIVE = 'instructive';
const CASE_INSTRUMENTAL = 'instrumental';
const CASE_INSTRUMENTAL_COMITATIVE = 'instrumental-comitative';
const CASE_INTRANSITIVE = 'intransitive';
const CASE_LATIVE = 'lative';
const CASE_LOCATIVE = 'locative';
const CASE_MODAL = 'modal';
const CASE_MULTIPLICATIVE = 'multiplicative';
const CASE_NOMINATIVE = 'nominative';
const CASE_PARTITIVE = 'partitive';
const CASE_PEGATIVE = 'pegative';
const CASE_PERLATIVE = 'perlative';
const CASE_POSSESSIVE = 'possessive';
const CASE_POSTELATIVE = 'postelative';
const CASE_POSTDIRECTIVE = 'postdirective';
const CASE_POSTESSIVE = 'postessive';
const CASE_POSTPOSITIONAL = 'postpositional';
const CASE_PREPOSITIONAL = 'prepositional';
const CASE_PRIVATIVE = 'privative';
const CASE_PROLATIVE = 'prolative';
const CASE_PROSECUTIVE = 'prosecutive';
const CASE_PROXIMATIVE = 'proximative';
const CASE_SEPARATIVE = 'separative';
const CASE_SOCIATIVE = 'sociative';
const CASE_SUBDIRECTIVE = 'subdirective';
const CASE_SUBESSIVE = 'subessive';
const CASE_SUBELATIVE = 'subelative';
const CASE_SUBLATIVE = 'sublative';
const CASE_SUPERDIRECTIVE = 'superdirective';
const CASE_SUPERESSIVE = 'superessive';
const CASE_SUPERLATIVE = 'superlative';
const CASE_SUPPRESSIVE = 'suppressive';
const CASE_TEMPORAL = 'temporal';
const CASE_TERMINATIVE = 'terminative';
const CASE_TRANSLATIVE = 'translative';
const CASE_VIALIS = 'vialis';
const CASE_VOCATIVE = 'vocative';
const MOOD_ADMIRATIVE = 'admirative';
const MOOD_COHORTATIVE = 'cohortative';
const MOOD_CONDITIONAL = 'conditional';
const MOOD_DECLARATIVE = 'declarative';
const MOOD_DUBITATIVE = 'dubitative';
const MOOD_ENERGETIC = 'energetic';
const MOOD_EVENTIVE = 'eventive';
const MOOD_GENERIC = 'generic';
const MOOD_GERUNDIVE = 'gerundive';
const MOOD_HYPOTHETICAL = 'hypothetical';
const MOOD_IMPERATIVE = 'imperative';
const MOOD_INDICATIVE = 'indicative';
const MOOD_INFERENTIAL = 'inferential';
const MOOD_INFINITIVE = 'infinitive';
const MOOD_INTERROGATIVE = 'interrogative';
const MOOD_JUSSIVE = 'jussive';
const MOOD_NEGATIVE = 'negative';
const MOOD_OPTATIVE = 'optative';
const MOOD_PARTICIPLE = 'participle';
const MOOD_PRESUMPTIVE = 'presumptive';
const MOOD_RENARRATIVE = 'renarrative';
const MOOD_SUBJUNCTIVE = 'subjunctive';
const MOOD_SUPINE = 'supine';
const NUM_SINGULAR = 'singular';
const NUM_PLURAL = 'plural';
const NUM_DUAL = 'dual';
const NUM_TRIAL = 'trial';
const NUM_PAUCAL = 'paucal';
const NUM_SINGULATIVE = 'singulative';
const NUM_COLLECTIVE = 'collective';
const NUM_DISTRIBUTIVE_PLURAL = 'distributive plural';
const NRL_CARDINAL = 'cardinal';
const NRL_ORDINAL = 'ordinal';
const NRL_DISTRIBUTIVE = 'distributive';
const NURL_NUMERAL_ADVERB = 'numeral adverb';
const ORD_1ST = '1st';
const ORD_2ND = '2nd';
const ORD_3RD = '3rd';
const ORD_4TH = '4th';
const ORD_5TH = '5th';
const ORD_6TH = '6th';
const ORD_7TH = '7th';
const ORD_8TH = '8th';
const ORD_9TH = '9th';
const TENSE_AORIST = 'aorist';
const TENSE_FUTURE = 'future';
const TENSE_FUTURE_PERFECT = 'future perfect';
const TENSE_IMPERFECT = 'imperfect';
const TENSE_PAST_ABSOLUTE = 'past absolute';
const TENSE_PERFECT = 'perfect';
const TENSE_PLUPERFECT = 'pluperfect';
const TENSE_PRESENT = 'present';
const VKIND_TO_BE = 'to be';
const VKIND_COMPOUNDS_OF_TO_BE = 'compounds of to be';
const VKIND_TAKING_ABLATIVE = 'taking ablative';
const VKIND_TAKING_DATIVE = 'taking dative';
const VKIND_TAKING_GENITIVE = 'taking genitive';
const VKIND_TRANSITIVE = 'transitive';
const VKIND_INTRANSITIVE = 'intransitive';
const VKIND_IMPERSONAL = 'impersonal';
const VKIND_DEPONENT = 'deponent';
const VKIND_SEMIDEPONENT = 'semideponent';
const VKIND_PERFECT_DEFINITE = 'perfect definite';
const VOICE_ACTIVE = 'active';
const VOICE_PASSIVE = 'passive';
const VOICE_MEDIOPASSIVE = 'mediopassive';
const VOICE_IMPERSONAL_PASSIVE = 'impersonal passive';
const VOICE_MIDDLE = 'middle';
const VOICE_ANTIPASSIVE = 'antipassive';
const VOICE_REFLEXIVE = 'reflexive';
const VOICE_RECIPROCAL = 'reciprocal';
const VOICE_CAUSATIVE = 'causative';
const VOICE_ADJUTATIVE = 'adjutative';
const VOICE_APPLICATIVE = 'applicative';
const VOICE_CIRCUMSTANTIAL = 'circumstantial';
const VOICE_DEPONENT = 'deponent';
const TYPE_IRREGULAR = 'irregular';
const TYPE_REGULAR = 'regular';
/* eslit-enable no-unused-vars */


var constants = Object.freeze({
	LANG_UNIT_WORD: LANG_UNIT_WORD,
	LANG_UNIT_CHAR: LANG_UNIT_CHAR,
	LANG_DIR_LTR: LANG_DIR_LTR,
	LANG_DIR_RTL: LANG_DIR_RTL,
	LANG_LATIN: LANG_LATIN,
	LANG_GREEK: LANG_GREEK,
	LANG_ARABIC: LANG_ARABIC,
	LANG_PERSIAN: LANG_PERSIAN,
	STR_LANG_CODE_LAT: STR_LANG_CODE_LAT,
	STR_LANG_CODE_LA: STR_LANG_CODE_LA,
	STR_LANG_CODE_GRC: STR_LANG_CODE_GRC,
	STR_LANG_CODE_ARA: STR_LANG_CODE_ARA,
	STR_LANG_CODE_AR: STR_LANG_CODE_AR,
	STR_LANG_CODE_FAR: STR_LANG_CODE_FAR,
	STR_LANG_CODE_PER: STR_LANG_CODE_PER,
	POFS_ADJECTIVE: POFS_ADJECTIVE,
	POFS_ADVERB: POFS_ADVERB,
	POFS_ADVERBIAL: POFS_ADVERBIAL,
	POFS_ARTICLE: POFS_ARTICLE,
	POFS_CONJUNCTION: POFS_CONJUNCTION,
	POFS_EXCLAMATION: POFS_EXCLAMATION,
	POFS_INTERJECTION: POFS_INTERJECTION,
	POFS_NOUN: POFS_NOUN,
	POFS_NUMERAL: POFS_NUMERAL,
	POFS_PARTICLE: POFS_PARTICLE,
	POFS_PREFIX: POFS_PREFIX,
	POFS_PREPOSITION: POFS_PREPOSITION,
	POFS_PRONOUN: POFS_PRONOUN,
	POFS_SUFFIX: POFS_SUFFIX,
	POFS_SUPINE: POFS_SUPINE,
	POFS_VERB: POFS_VERB,
	POFS_VERB_PARTICIPLE: POFS_VERB_PARTICIPLE,
	GEND_MASCULINE: GEND_MASCULINE,
	GEND_FEMININE: GEND_FEMININE,
	GEND_NEUTER: GEND_NEUTER,
	GEND_COMMON: GEND_COMMON,
	GEND_ANIMATE: GEND_ANIMATE,
	GEND_INANIMATE: GEND_INANIMATE,
	GEND_PERSONAL_MASCULINE: GEND_PERSONAL_MASCULINE,
	GEND_ANIMATE_MASCULINE: GEND_ANIMATE_MASCULINE,
	GEND_INANIMATE_MASCULINE: GEND_INANIMATE_MASCULINE,
	COMP_POSITIVE: COMP_POSITIVE,
	COMP_COMPARITIVE: COMP_COMPARITIVE,
	COMP_SUPERLATIVE: COMP_SUPERLATIVE,
	CASE_ABESSIVE: CASE_ABESSIVE,
	CASE_ABLATIVE: CASE_ABLATIVE,
	CASE_ABSOLUTIVE: CASE_ABSOLUTIVE,
	CASE_ACCUSATIVE: CASE_ACCUSATIVE,
	CASE_ADDIRECTIVE: CASE_ADDIRECTIVE,
	CASE_ADELATIVE: CASE_ADELATIVE,
	CASE_ADESSIVE: CASE_ADESSIVE,
	CASE_ADVERBIAL: CASE_ADVERBIAL,
	CASE_ALLATIVE: CASE_ALLATIVE,
	CASE_ANTESSIVE: CASE_ANTESSIVE,
	CASE_APUDESSIVE: CASE_APUDESSIVE,
	CASE_AVERSIVE: CASE_AVERSIVE,
	CASE_BENEFACTIVE: CASE_BENEFACTIVE,
	CASE_CARITIVE: CASE_CARITIVE,
	CASE_CAUSAL: CASE_CAUSAL,
	CASE_CAUSAL_FINAL: CASE_CAUSAL_FINAL,
	CASE_COMITATIVE: CASE_COMITATIVE,
	CASE_DATIVE: CASE_DATIVE,
	CASE_DELATIVE: CASE_DELATIVE,
	CASE_DIRECT: CASE_DIRECT,
	CASE_DISTRIBUTIVE: CASE_DISTRIBUTIVE,
	CASE_DISTRIBUTIVE_TEMPORAL: CASE_DISTRIBUTIVE_TEMPORAL,
	CASE_ELATIVE: CASE_ELATIVE,
	CASE_ERGATIVE: CASE_ERGATIVE,
	CASE_ESSIVE: CASE_ESSIVE,
	CASE_ESSIVE_FORMAL: CASE_ESSIVE_FORMAL,
	CASE_ESSIVE_MODAL: CASE_ESSIVE_MODAL,
	CASE_EQUATIVE: CASE_EQUATIVE,
	CASE_EVITATIVE: CASE_EVITATIVE,
	CASE_EXESSIVE: CASE_EXESSIVE,
	CASE_FINAL: CASE_FINAL,
	CASE_FORMAL: CASE_FORMAL,
	CASE_GENITIVE: CASE_GENITIVE,
	CASE_ILLATIVE: CASE_ILLATIVE,
	CASE_INELATIVE: CASE_INELATIVE,
	CASE_INESSIVE: CASE_INESSIVE,
	CASE_INSTRUCTIVE: CASE_INSTRUCTIVE,
	CASE_INSTRUMENTAL: CASE_INSTRUMENTAL,
	CASE_INSTRUMENTAL_COMITATIVE: CASE_INSTRUMENTAL_COMITATIVE,
	CASE_INTRANSITIVE: CASE_INTRANSITIVE,
	CASE_LATIVE: CASE_LATIVE,
	CASE_LOCATIVE: CASE_LOCATIVE,
	CASE_MODAL: CASE_MODAL,
	CASE_MULTIPLICATIVE: CASE_MULTIPLICATIVE,
	CASE_NOMINATIVE: CASE_NOMINATIVE,
	CASE_PARTITIVE: CASE_PARTITIVE,
	CASE_PEGATIVE: CASE_PEGATIVE,
	CASE_PERLATIVE: CASE_PERLATIVE,
	CASE_POSSESSIVE: CASE_POSSESSIVE,
	CASE_POSTELATIVE: CASE_POSTELATIVE,
	CASE_POSTDIRECTIVE: CASE_POSTDIRECTIVE,
	CASE_POSTESSIVE: CASE_POSTESSIVE,
	CASE_POSTPOSITIONAL: CASE_POSTPOSITIONAL,
	CASE_PREPOSITIONAL: CASE_PREPOSITIONAL,
	CASE_PRIVATIVE: CASE_PRIVATIVE,
	CASE_PROLATIVE: CASE_PROLATIVE,
	CASE_PROSECUTIVE: CASE_PROSECUTIVE,
	CASE_PROXIMATIVE: CASE_PROXIMATIVE,
	CASE_SEPARATIVE: CASE_SEPARATIVE,
	CASE_SOCIATIVE: CASE_SOCIATIVE,
	CASE_SUBDIRECTIVE: CASE_SUBDIRECTIVE,
	CASE_SUBESSIVE: CASE_SUBESSIVE,
	CASE_SUBELATIVE: CASE_SUBELATIVE,
	CASE_SUBLATIVE: CASE_SUBLATIVE,
	CASE_SUPERDIRECTIVE: CASE_SUPERDIRECTIVE,
	CASE_SUPERESSIVE: CASE_SUPERESSIVE,
	CASE_SUPERLATIVE: CASE_SUPERLATIVE,
	CASE_SUPPRESSIVE: CASE_SUPPRESSIVE,
	CASE_TEMPORAL: CASE_TEMPORAL,
	CASE_TERMINATIVE: CASE_TERMINATIVE,
	CASE_TRANSLATIVE: CASE_TRANSLATIVE,
	CASE_VIALIS: CASE_VIALIS,
	CASE_VOCATIVE: CASE_VOCATIVE,
	MOOD_ADMIRATIVE: MOOD_ADMIRATIVE,
	MOOD_COHORTATIVE: MOOD_COHORTATIVE,
	MOOD_CONDITIONAL: MOOD_CONDITIONAL,
	MOOD_DECLARATIVE: MOOD_DECLARATIVE,
	MOOD_DUBITATIVE: MOOD_DUBITATIVE,
	MOOD_ENERGETIC: MOOD_ENERGETIC,
	MOOD_EVENTIVE: MOOD_EVENTIVE,
	MOOD_GENERIC: MOOD_GENERIC,
	MOOD_GERUNDIVE: MOOD_GERUNDIVE,
	MOOD_HYPOTHETICAL: MOOD_HYPOTHETICAL,
	MOOD_IMPERATIVE: MOOD_IMPERATIVE,
	MOOD_INDICATIVE: MOOD_INDICATIVE,
	MOOD_INFERENTIAL: MOOD_INFERENTIAL,
	MOOD_INFINITIVE: MOOD_INFINITIVE,
	MOOD_INTERROGATIVE: MOOD_INTERROGATIVE,
	MOOD_JUSSIVE: MOOD_JUSSIVE,
	MOOD_NEGATIVE: MOOD_NEGATIVE,
	MOOD_OPTATIVE: MOOD_OPTATIVE,
	MOOD_PARTICIPLE: MOOD_PARTICIPLE,
	MOOD_PRESUMPTIVE: MOOD_PRESUMPTIVE,
	MOOD_RENARRATIVE: MOOD_RENARRATIVE,
	MOOD_SUBJUNCTIVE: MOOD_SUBJUNCTIVE,
	MOOD_SUPINE: MOOD_SUPINE,
	NUM_SINGULAR: NUM_SINGULAR,
	NUM_PLURAL: NUM_PLURAL,
	NUM_DUAL: NUM_DUAL,
	NUM_TRIAL: NUM_TRIAL,
	NUM_PAUCAL: NUM_PAUCAL,
	NUM_SINGULATIVE: NUM_SINGULATIVE,
	NUM_COLLECTIVE: NUM_COLLECTIVE,
	NUM_DISTRIBUTIVE_PLURAL: NUM_DISTRIBUTIVE_PLURAL,
	NRL_CARDINAL: NRL_CARDINAL,
	NRL_ORDINAL: NRL_ORDINAL,
	NRL_DISTRIBUTIVE: NRL_DISTRIBUTIVE,
	NURL_NUMERAL_ADVERB: NURL_NUMERAL_ADVERB,
	ORD_1ST: ORD_1ST,
	ORD_2ND: ORD_2ND,
	ORD_3RD: ORD_3RD,
	ORD_4TH: ORD_4TH,
	ORD_5TH: ORD_5TH,
	ORD_6TH: ORD_6TH,
	ORD_7TH: ORD_7TH,
	ORD_8TH: ORD_8TH,
	ORD_9TH: ORD_9TH,
	TENSE_AORIST: TENSE_AORIST,
	TENSE_FUTURE: TENSE_FUTURE,
	TENSE_FUTURE_PERFECT: TENSE_FUTURE_PERFECT,
	TENSE_IMPERFECT: TENSE_IMPERFECT,
	TENSE_PAST_ABSOLUTE: TENSE_PAST_ABSOLUTE,
	TENSE_PERFECT: TENSE_PERFECT,
	TENSE_PLUPERFECT: TENSE_PLUPERFECT,
	TENSE_PRESENT: TENSE_PRESENT,
	VKIND_TO_BE: VKIND_TO_BE,
	VKIND_COMPOUNDS_OF_TO_BE: VKIND_COMPOUNDS_OF_TO_BE,
	VKIND_TAKING_ABLATIVE: VKIND_TAKING_ABLATIVE,
	VKIND_TAKING_DATIVE: VKIND_TAKING_DATIVE,
	VKIND_TAKING_GENITIVE: VKIND_TAKING_GENITIVE,
	VKIND_TRANSITIVE: VKIND_TRANSITIVE,
	VKIND_INTRANSITIVE: VKIND_INTRANSITIVE,
	VKIND_IMPERSONAL: VKIND_IMPERSONAL,
	VKIND_DEPONENT: VKIND_DEPONENT,
	VKIND_SEMIDEPONENT: VKIND_SEMIDEPONENT,
	VKIND_PERFECT_DEFINITE: VKIND_PERFECT_DEFINITE,
	VOICE_ACTIVE: VOICE_ACTIVE,
	VOICE_PASSIVE: VOICE_PASSIVE,
	VOICE_MEDIOPASSIVE: VOICE_MEDIOPASSIVE,
	VOICE_IMPERSONAL_PASSIVE: VOICE_IMPERSONAL_PASSIVE,
	VOICE_MIDDLE: VOICE_MIDDLE,
	VOICE_ANTIPASSIVE: VOICE_ANTIPASSIVE,
	VOICE_REFLEXIVE: VOICE_REFLEXIVE,
	VOICE_RECIPROCAL: VOICE_RECIPROCAL,
	VOICE_CAUSATIVE: VOICE_CAUSATIVE,
	VOICE_ADJUTATIVE: VOICE_ADJUTATIVE,
	VOICE_APPLICATIVE: VOICE_APPLICATIVE,
	VOICE_CIRCUMSTANTIAL: VOICE_CIRCUMSTANTIAL,
	VOICE_DEPONENT: VOICE_DEPONENT,
	TYPE_IRREGULAR: TYPE_IRREGULAR,
	TYPE_REGULAR: TYPE_REGULAR
});

class Definition {
  constructor (text, language, format) {
    this.text = text;
    this.language = language;
    this.format = format;
  }
}

var DefaultConfig = "{\n  \"lsj\": {\n    \"shortUrl\": \"https://raw.githubusercontent.com/alpheios-project/lsj/master/dat/grc-lsj-defs.dat\",\n    \"indexUrl\": \"https://raw.githubusercontent.com/alpheios-project/lsj/master/dat/grc-lsj-ids.dat\",\n    \"longLemmaUrl\": \"http://repos1.alpheios.net/exist/rest/db/xq/lexi-get.xq?lx=lsj&lg=grc&out=html&l=r_LEMMA\",\n    \"longIdUrl\": \"http://repos1.alpheios.net/exist/rest/db/xq/lexi-get.xq?lx=lsj&lg=grc&out=html&n=r_ID\",\n    \"sourceLang\": \"grc\",\n    \"targetLang\": \"en\",\n    \"sourceCredit\": \"Definitions provided by LSJ\"\n  }\n}\n";

class AlpheiosLexAdapter extends BaseDictAdapter {
  /**
   * A Client Adapter for the Alpheios Lexicon service
   * @constructor
   * @param {string} lexid - the idenitifer code for the lexicon this instance
   *                         provides access to
   * @param {Object} config - JSON configuration object override
   */
  constructor (lexid = null, config = null) {
    super();
    this.lexid = lexid;
    this.data = null;
    this.index = null;
    if (config == null) {
      try {
        let fullconfig = JSON.parse(DefaultConfig);
        this.config = fullconfig[lexid];
      } catch (e) {
        this.config = DefaultConfig[lexid];
      }
    } else {
      this.config = config;
    }
  }

  /**
   * @override BaseDictAdapter#lookupFullDef
   */
  async lookupFullDef (lemma = null) {
    // TODO figure out the best way to handle initial reading of the data file
    if (this.index === null && this.getConfig('indexUrl')) {
      let url = this.getConfig('indexUrl');
      let unparsed = await this._loadData(url);
      let parsed = papaparse.parse(unparsed, {});
      this.index = new Map(parsed.data);
    }
    let id;
    if (this.index) {
      id = this._lookupInDataIndex(this.index, lemma);
    }
    let url;
    if (id) {
      url = this.getConfig('longIdUrl').replace('r_ID', id);
    } else {
      url = this.getConfig('longLemmaUrl').replace('r_LEMMA', lemma.word);
    }
    let targetLanguage = this.getConfig('targetLang');
    let sourceCredit = this.getConfig('sourceCredit');
    let p = new Promise((resolve, reject) => {
      window.fetch(url).then(
          function (response) {
            let text = response.text();
            resolve(text);
          }
        ).catch((error) => {
          reject(error);
        });
    });
    return p.then((result) => { return new Definition(result, targetLanguage, 'text/html', sourceCredit) })
  }

  /**
   * @override BaseDictAdapter#lookupShortDef
   */
  async lookupShortDef (lemma = null) {
    if (this.data === null) {
      let url = this.getConfig('shortUrl');
      let unparsed = await this._loadData(url);
      let parsed = papaparse.parse(unparsed, {});
      this.data = new Map(parsed.data);
    }
    let deftext = this._lookupInDataIndex(this.data, lemma);
    return new Definition(deftext, this.getConfig('targetLang'), 'text/plain', this.getConfig('sourceCredit'))
  }

  /**
   * Lookup a Lemma object in an Alpheios v1 data index
   * @param {Map} data the data inddex
   * @param {Lemma} lemma the lemma to lookupInDataIndex
   * @return {string} the index entry as a text string
   */
  _lookupInDataIndex (data, lemma) {
    // legacy behavior from Alpheios lemma data file indices
    // first look to see if we explicitly have an instance of this lemma
    // with capitalization retained
    let found;

    let alternatives = [];
    for (let l of [...lemma.principalParts, lemma.word]) {
      alternatives.push(l);
      let nosense = l.replace(/_?\d+$/, '');
      if (l !== nosense) {
        alternatives.push(nosense);
      }
    }
    // TODO may be other language specific normalizations here

    for (let lookup of alternatives) {
      found = data.get(lookup.toLocaleLowerCase());
      if (found === '@') {
        found = data.get(`@${lookup}`);
      }
      if (found) {
        break
      }
    }
    return found
  }

  _loadData (url) {
    // TODO figure out best way to load this data
    return new Promise((resolve, reject) => {
      window.fetch(url).then(
          function (response) {
            let text = response.text();
            resolve(text);
          }
        ).catch((error) => {
          reject(error);
        });
    })
  }

  getConfig (property) {
    return this.config[property]
  }
}

export { AlpheiosLexAdapter };
//# sourceMappingURL=alpheios-dict-client.js.map
