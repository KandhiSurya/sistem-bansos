const JSDOMEnvironment = require('jest-environment-jsdom').default || require('jest-environment-jsdom');

class CustomEnvironment extends JSDOMEnvironment {
  async setup() {
    await super.setup();

    // Inject missing globals from Node.js into the JSDOM environment
    this.global.fetch = fetch;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.Headers = Headers;
    this.global.FormData = FormData;
    this.global.Blob = Blob;
    this.global.File = File;
    if (typeof TextEncoder !== 'undefined') this.global.TextEncoder = TextEncoder;
    if (typeof TextDecoder !== 'undefined') this.global.TextDecoder = TextDecoder;
    if (typeof structuredClone !== 'undefined') this.global.structuredClone = structuredClone;
  }
}

module.exports = CustomEnvironment;
