import {parsePs33Node} from './moduleParser.js';
import {parsePs35Node} from './vrParser.js';
import {
  parsePs36TagsNode,
  parsePs37Node
} from './tagParser.js';
import {parsePs36UIDNode} from './uidParser.js';

/**
 * @import {DicomTag} from './tagParser.js';
 * @import {DicomUID} from './uidParser.js';
 * @import {DicomModule, DicomModuleAttributes} from './moduleParser.js';
 */

/**
 * DICOM parse result class.
 */
export class DicomParseResult {
  /**
   * @type {string}
   */
  name;
  /**
   * @type {string}
   */
  origin;
  /**
   * @type {DicomTag[]|DicomUID[]|DicomModule[]}
   */
  raw;
  /**
   * @type {string}
   */
  data;
}

/**
 * DICOM xml parser.
 */
export class DicomXMLParser {

  /**
   * Parse a DICOM standard xml node.
   *
   * @param {Document} partNode The main DOM node.
   * @param {string} [origin] Optional origin of the node.
   * @returns {DicomParseResult[]} Parse results.
   */
  parseNode(partNode, origin) {
    // get book node
    const book = partNode.querySelector('book');
    if (!book) {
      throw new Error('No book node.');
    }
    // get book label
    const label = book.getAttribute('label');
    if (!label) {
      throw new Error('No book label.');
    }

    // get version
    // 'DICOM PS3.5 2020a - ...'
    const subtitle = book.querySelector('subtitle');
    if (!subtitle) {
      throw new Error('No book subtitle.');
    }
    const prefix = 'DICOM ' + label;
    if (!subtitle.innerHTML.startsWith(prefix)) {
      throw new Error('Missing DICOM standard version prefix.');
    }
    const endIndex = subtitle.innerHTML.indexOf('-');
    const versionStr =
      subtitle.innerHTML.substring(prefix.length, endIndex).trim();
    const version = {
      year: parseInt(versionStr.substring(0, 4), 10),
      letter: versionStr.substring(4)
    };


    let result;

    if (label === 'PS3.3') {
      result = parsePs33Node(partNode, origin);
    } else if (label === 'PS3.5') {
      result = parsePs35Node(partNode, origin, version);
    } else if (label === 'PS3.6') {
      const resTags = parsePs36TagsNode(partNode, origin);
      const resUids = parsePs36UIDNode(partNode, origin);
      result = [...resTags, ...resUids];
    } else if (label === 'PS3.7') {
      result = parsePs37Node(partNode, origin);
    } else {
      throw new Error('Unknown book label: ' + label);
    }

    return result;
  }
}
