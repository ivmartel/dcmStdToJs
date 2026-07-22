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

  /**
   * Parse tags.
   *
   * @param {Document[]} parts The DOM nodes.
   * @param {string} [origin] Optional origin of the node.
   * @returns {DicomParseResult[]} Parse results.
   */
  parseTags(parts, origin) {
    if (parts.length !== 2) {
      throw new Error('Not the expected parts for tags parse');
    }

    let index36;
    let index37;
    const otherIndex = [];
    for (let i = 0; i < parts.length; ++i) {
      const info = getStdInfo(parts[i]);
      if (info.label === 'PS3.6') {
        index36 = i;
      } else if (info.label === 'PS3.7') {
        index37 = i;
      } else {
        otherIndex.push(i);
      }
    }

    let result;

    if (typeof index36 !== 'undefined' &&
      typeof index37 !== 'undefined') {
      const resTags36 = parsePs36TagsNode(parts[index36], origin)[0];
      const resTags37 = parsePs37Node(parts[index37], origin)[0];
      const rawTags36 = /** @type {DicomTag[]} */ (resTags36.raw);
      const rawTags37 = /** @type {DicomTag[]} */ (resTags37.raw);
      const rawTags = [...rawTags37, ...rawTags36];
      const data36 = resTags36.data;
      const data37 = resTags37.data;
      const dataTags = data37.substring(0, data37.length - 2) + ',' +
        data36.substring(1);
      result = [{
        name: resTags36.name,
        origin: resTags36.origin,
        raw: rawTags,
        data: dataTags,
      }];
    } else {
      throw new Error('Wrong labels for tags parse: ' +
        otherIndex.toString()
      );
    }

    return result;
  }

  /**
   * Parse UIDs.
   *
   * @param {Document[]} parts The DOM nodes.
   * @param {string} [origin] Optional origin of the node.
   * @returns {DicomParseResult[]} Parse results.
   */
  parseUids(parts, origin) {
    // check info
    const {label, subtitle} = getStdInfo(parts[0]);
    // check version
    const version = getStdVersion(label, subtitle);
    if (typeof version === 'undefined') {
      throw new Error('Undefined DICOM standard version.');
    }

    let result;

    if (label === 'PS3.6') {
      result = parsePs36UIDNode(parts[0], origin);
    } else {
      throw new Error('Wrong label for UID parse: ' + label);
    }

    return result;
  }

  /**
   * Parse VRs.
   *
   * @param {Document[]} parts The DOM nodes.
   * @param {string} [origin] Optional origin of the node.
   * @returns {DicomParseResult[]} Parse results.
   */
  parseVrs(parts, origin) {
    // check info
    const {label, subtitle} = getStdInfo(parts[0]);
    // check version
    const version = getStdVersion(label, subtitle);
    if (typeof version === 'undefined') {
      throw new Error('Undefined DICOM standard version.');
    }

    let result;

    if (label === 'PS3.5') {
      result = parsePs35Node(parts[0], origin);
    } else {
      throw new Error('Wrong label for VR parse: ' + label);
    }

    return result;
  }

  /**
   * Parse Modules.
   *
   * @param {Document[]} parts The DOM nodes.
   * @param {string} [origin] Optional origin of the node.
   * @returns {DicomParseResult[]} Parse results.
   */
  parseModules(parts, origin) {
    // check info
    const {label, subtitle} = getStdInfo(parts[0]);
    // check version
    const version = getStdVersion(label, subtitle);
    if (typeof version === 'undefined') {
      throw new Error('Undefined DICOM standard version.');
    }

    let result;

    if (label === 'PS3.3') {
      result = parsePs33Node(parts[0], origin);
    } else {
      throw new Error('Wrong label for module parse: ' + label);
    }

    return result;
  }
}
