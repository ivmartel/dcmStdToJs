# dcmStdToJs

[![Node.js CI](https://github.com/ivmartel/dcmStdToJs/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/ivmartel/dcmStdToJs/actions/workflows/nodejs-ci.yml)

Generate js/json from the DICOM standard in xml.

## Usage

The package is an ES module (`require` needs Node.js 20.19+ or 22.12+).
The parser takes DOM documents: in the browser, use `DOMParser`;
in Node.js, use a DOM implementation such as [jsdom](https://github.com/jsdom/jsdom):

```js
import {JSDOM} from 'jsdom';
import {DicomXMLParser} from 'dcmstdtojs';

const {window} = new JSDOM();
const doc = new window.DOMParser().parseFromString(xml, 'application/xml');
const results = new DicomXMLParser().parseNode(doc);
```

## TypeScript

Type definitions are included. They only use basic syntax and work with
TypeScript 2.1+ (resolving them through `exports` needs TypeScript 4.7+
with `node16` or 5.0+ with `bundler` module resolution; older setups use
the `types` field). The parser API uses DOM types (`Document`),
so TypeScript users need `"dom"` in their `lib` compiler option
(or `skipLibCheck: true`).

## Available Scripts

- `install`: install dependencies
- `start`: serve with hot reload at localhost:8080
- `lint`: lint files
- `test`: run tests
- `doc`: generate documentation

## Similar initiatives

* [generate_dicom_dict.py](https://github.com/pydicom/pydicom/blob/v2.1.2/source/generate_dict/generate_dicom_dict.py) from [pydicom](https://github.com/pydicom/pydicom)
* [generate-dictionary.js](https://github.com/dcmjs-org/dcmjs/blob/v0.18.8/generate-dictionary.js) from [dcmjs](https://github.com/dcmjs-org/dcmjs)
