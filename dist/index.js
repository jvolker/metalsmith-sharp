"use strict";

require("core-js/modules/es.array.iterator");

require("core-js/modules/es.promise");

require("core-js/modules/es.string.replace");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _path = require("path");

var _lodash = require("lodash");

var _multimatch = _interopRequireDefault(require("multimatch"));

var _debug = _interopRequireDefault(require("debug"));

var _sharp = _interopRequireDefault(require("sharp"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const debug = (0, _debug.default)('metalsmith-sharp');

function replacePlaceholders(text, placeholders) {
  return text.replace(/\{([^}]+)\}/g, (match, pattern) => {
    if (pattern in placeholders) {
      return placeholders[pattern];
    }

    return match;
  });
}

function getReplacements(path) {
  const parsedPath = (0, _path.parse)(path);

  if (parsedPath.dir.length) {
    parsedPath.dir = `${parsedPath.dir}/`;
  }

  return parsedPath;
}

function runSharp(image, options) {
  const sharp = (0, _sharp.default)(image.contents);
  return sharp.metadata().then(metadata => {
    options.methods.forEach(method => {
      let args;

      if (typeof method.args === 'function') {
        args = method.args(metadata);
      } else {
        args = [].concat(method.args);
      }

      sharp[method.name](...args);
    });
    return sharp.toBuffer();
  });
}

function _default(userOptions) {
  const defaultOptions = {
    src: '**/*.jpg',
    namingPattern: '{dir}{base}',
    methods: [],
    moveFile: false
  };
  const optionsList = [].concat(userOptions); // Return metalsmith plugin.

  return function (files, metalsmith, done) {
    Object.keys(files).reduce((fileSequence, filename) => {
      return fileSequence.then(() => {
        const file = files[filename];
        const replacements = getReplacements(filename); // src pattern will be reset when passing options on per file basis

        if (file.sharp) {
          file.sharp = [].concat(file.sharp);

          for (const option of file.sharp) {
            option.src = filename;
          }
        } // combine option sets passed on module call with options given on a per file basis


        const combinedOptionsList = file.sharp ? optionsList.concat(file.sharp) : optionsList; // Iterate over all option sets.

        return combinedOptionsList.reduce((stepSequence, options) => {
          const stepOptions = _objectSpread(_objectSpread({}, defaultOptions), options);

          if (!(0, _multimatch.default)(filename, stepOptions.src)) {
            return stepSequence;
          }

          debug(`processing ${filename}`);
          const image = (0, _lodash.cloneDeep)(file); // Run sharp and save new file.

          return stepSequence.then(() => runSharp(image, stepOptions)).catch(err => {
            err.message = `Could not process file "${filename}":\n${err.message}`;
            return Promise.reject(err);
          }).then((buffer, info) => {
            const dist = replacePlaceholders(stepOptions.namingPattern, replacements);
            image.contents = buffer;
            files[dist] = image;

            if (filename !== dist && stepOptions.moveFile) {
              delete files[filename];
            }
          });
        }, Promise.resolve());
      });
    }, Promise.resolve()).then(() => {
      done();
    }).catch(err => {
      done(err);
    });
  };
}

module.exports = exports.default;