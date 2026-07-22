import {getStdInfo, getStdVersion} from './genericParser.js';
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
    // check info
    const {label, subtitle} = getStdInfo(partNode);
    // check version
    const version = getStdVersion(label, subtitle);
    if (typeof version === 'undefined') {
      throw new Error('Undefined DICOM standard version.');
    }

    let result;

    if (label === 'PS3.3') {
      result = parsePs33Node(partNode, origin);
    } else if (label === 'PS3.5') {
      result = parsePs35Node(partNode, origin);
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
