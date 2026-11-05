import fs from 'fs';

const poly = `/* PrintMate Worker Compatibility Polyfill */
if (typeof self !== 'undefined') {
  if (typeof self.Promise !== 'undefined' && typeof self.Promise.withResolvers === 'undefined') {
    self.Promise.withResolvers = function() {
      var resolve, reject;
      var promise = new Promise(function(res, rej) {
        resolve = res;
        reject = rej;
      });
      return { promise: promise, resolve: resolve, reject: reject };
    };
  }
  if (typeof self.Object !== 'undefined' && typeof self.Object.hasOwn === 'undefined') {
    self.Object.hasOwn = function(object, property) {
      if (object == null) throw new TypeError('Cannot convert undefined or null to object');
      return Object.prototype.hasOwnProperty.call(Object(object), property);
    };
  }
  if (typeof self.Array !== 'undefined' && self.Array.prototype) {
    if (!self.Array.prototype.at) {
      self.Array.prototype.at = function(n) {
        n = Math.trunc(n) || 0;
        if (n < 0) n += this.length;
        if (n < 0 || n >= this.length) return undefined;
        return this[n];
      };
    }
    if (!self.Array.prototype.findLast) {
      self.Array.prototype.findLast = function(predicate, thisArg) {
        for (var i = this.length - 1; i >= 0; i--) {
          if (predicate.call(thisArg, this[i], i, this)) return this[i];
        }
        return undefined;
      };
    }
  }
}
`;

const targetPath = 'public/pdf.worker.min.mjs';
if (fs.existsSync(targetPath)) {
  const orig = fs.readFileSync(targetPath, 'utf8');
  if (!orig.includes('PrintMate Worker Compatibility Polyfill')) {
    fs.writeFileSync(targetPath, poly + '\n' + orig);
    console.log('Successfully prepended worker polyfill to public/pdf.worker.min.mjs!');
  } else {
    console.log('Worker polyfill already present');
  }
}
