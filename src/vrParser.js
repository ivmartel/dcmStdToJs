import {
  getSelector,
  checkNodeCaption,
  parseTableNode
} from './genericParser.js';

/**
 * @import {DicomParseResult} from './parser.js';
 */

/**
 * Parse a PS3.5 node: Data Structures and Encoding.
 * See: {@link https://dicom.nema.org/medical/dicom/current/output/chtml/part05/PS3.5.html}.
 *
 * @param {Document} partNode The main DOM node.
 * @param {string} origin The origin of the node.
 * @param {object} version The version of the standard.
 * @returns {DicomParseResult[]} The parse results.
 */
export function parsePs35Node(partNode, origin, version) {
  // VRs
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_6.2.html#table_6.2-1
  const vrs = parseVrTableNode(
    partNode.querySelector(getSelector('table_6.2-1')),
    undefined,
    'DICOM Value Representations');

  const vrsNames = Object.keys(vrs);

  // replace undefined with null for JSON
  for (let i = 0; i < vrsNames.length; ++i) {
    if (typeof vrs[vrsNames[i]] === 'undefined') {
      vrs[vrsNames[i]] = null;
    }
  }

  const vrsResult = {
    name: 'VRs',
    origin: origin,
    raw: vrs,
    data: JSON.stringify(vrs, null, '  ')
  };

  // 32-bit VL VRs
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part05/chapter_7.html#table_7.1-1
  // table 7.1-1 caption:
  // - before 2019e: 'Data Element with Explicit VR of OB, OD...'
  // - >= 2019e: 'Data Element with Explicit VR other than as shown
  //   in Table 7.1-2'
  let isBefore2019e = true;
  if (version.year > 2019 ||
    (version.year === 2019 && version.letter >= 'e')) {
    isBefore2019e = false;
  }

  let xmlid = 'table_7.1-2';
  if (isBefore2019e) {
    xmlid = 'table_7.1-1';
  }
  const specialVrs = parseVrCaptionNode(
    partNode.querySelector(getSelector(xmlid)),
    'Data Element with Explicit VR');

  let vrVl32s = specialVrs;
  if (!isBefore2019e) {
    vrVl32s = vrsNames.filter(function (item) {
      return !specialVrs.includes(item);
    });
  }

  const vrVl32Result = {
    name: '32-bit VL VRs',
    origin: origin,
    raw: vrVl32s,
    data: JSON.stringify(vrVl32s)
  };

  // Extended or replaced default character repertoire VRs
  // https://dicom.nema.org/medical/dicom/current/output/html/part05.html#sect_6.1.2.2
  const charSetVrs = parseCharSetVrNode(
    partNode.querySelector(getSelector('sect_6.1.2.2')));

  const charSetVrResult = {
    name: 'Character Set VRs',
    origin: origin,
    raw: charSetVrs,
    data: JSON.stringify(charSetVrs)
  };

  return [vrsResult, vrVl32Result, charSetVrResult];
}

/**
 * Parse a VR 32bit VL DICOM standard XML node.
 *
 * @param {Element} node The content node.
 * @param {string} expectedCaptionRoot The expected node caption root.
 * @returns {string[]} The list VRs.
 */
function parseVrCaptionNode(node, expectedCaptionRoot) {
  // check node
  if (!node) {
    throw new Error('No Vr caption node.');
  }
  // check caption
  checkNodeCaption(node, expectedCaptionRoot, false);
  // expecting something like:
  // 'Data Element with Explicit VR of OB, OW, OF, OD, SQ, UT or UN'
  const regex = /(?:\s)([A-Z]{2})(?:,|\sor|\sand|$)/g;
  const caption = node.getElementsByTagName('caption');
  const text = caption[0].innerHTML;
  const matches = text.matchAll(regex);
  const result = [];
  for (const match of matches) {
    result.push(match[1]); // [0] includes non capturing groups
  }
  return result;
}

/**
 * Extract a string VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function stringVrTypeExtractor(str) {
  let type;
  if (str.startsWith('A string of characters') ||
    str.startsWith('A character string') ||
    str.startsWith('A concatenated date-time character string')) {
    type = 'string';
  }
  return type;
}

/**
 * Extract an octet VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function octetVrTypeExtractor(str) {
  let type;
  // pre 2017 uses string and not stream...
  if (str.startsWith('An octet-stream') ||
    str.startsWith('A string of bytes')) {
    type = 'Uint8';
  }
  return type;
}

/**
 * Extract a integer VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function intVrTypeExtractor(str) {
  let type;
  const regex = /(Signed|Unsigned) binary integer (\d{2}) bits long/g;
  const match = [...str.matchAll(regex)];
  if (match.length === 1 && match[0].length === 3) {
    type = match[0][1] === 'Unsigned' ? 'Ui' : 'I';
    type += 'nt' + match[0][2];
  }
  return type;
}

/**
 * Extract a float VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function floatVrTypeExtractor(str) {
  let type;
  const regex = /IEEE 754:1985 (\d{2})-bit Floating Point Number/g;
  const match = [...str.matchAll(regex)];
  if (match.length === 1 && match[0].length === 2) {
    type = 'Float' + match[0][1];
  }
  return type;
}

/**
 * Extract a word VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function wordVrTypeExtractor(str) {
  let type;
  // pre 2017 uses string and not stream...
  const regex = /A (?:stream|string) of (\d{2})-bit words/g;
  const match = [...str.matchAll(regex)];
  if (match.length === 1 && match[0].length === 2) {
    type = 'Uint' + match[0][1];
  }
  return type;
}

/**
 * Extract a flaot word VR type for a string.
 *
 * @param {string} str Input string.
 * @returns {string|undefined} The type if found or undefined.
 */
function floatWordVrTypeExtractor(str) {
  let type;
  const regex = /(\d{2})-bit IEEE 754:1985 floating point words/g;
  const match = [...str.matchAll(regex)];
  if (match.length === 1 && match[0].length === 2) {
    type = 'Uint' + match[0][1];
  }
  return type;
}

/**
 * Parse a VR 32bit VL DICOM standard XML node.
 *
 * @param {Element} tableNode The content node.
 * @param {Document} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption root.
 * @returns {object} The map of VR name to type.
 */
function parseVrTableNode(tableNode, partNode, expectedCaption) {
  const values = parseTableNode(tableNode, partNode, expectedCaption);
  const vrs = {};

  const extractors = [
    stringVrTypeExtractor,
    octetVrTypeExtractor,
    intVrTypeExtractor,
    floatVrTypeExtractor,
    wordVrTypeExtractor,
    floatWordVrTypeExtractor
  ];

  for (const value of values) {
    // 'short' VR name
    const vrName = value[0][0];
    // definition
    const definition = value[1][0];
    let type;
    for (const extractor of extractors) {
      type = extractor(definition);
      // exit if found
      if (typeof type !== 'undefined') {
        break;
      }
    }
    // log unknown types (typically AT and SQ)
    if (typeof type === 'undefined') {
      console.log('Unknown VR type for ' + vrName);
    }
    // store
    vrs[vrName] = type;
  }
  return vrs;
}

/**
 * Parse a Character Set VR DICOM standard XML node.
 *
 * @param {Element} node The content node.
 * @returns {string[]} The list of VRs.
 */
function parseCharSetVrNode(node) {
  // check node
  if (!node) {
    throw new Error('No char Vr node.');
  }

  const result = [];

  // expecting something like:
  // For Data Elements with Value Representations of SH (Short String),
  // LO (Long String), UC (Unlimited Characters), ST (Short Text),
  // LT (Long Text), UT (Unlimited Text) or PN (Person Name)
  const regex = /(?:\s)([A-Z]{2})(?:\s\(\w+\s\w+\))/g;
  const paras = node.getElementsByTagName('para');
  for (const para of paras) {
    if (para.innerHTML.startsWith(
      'For Data Elements with Value Representations')) {
      const text = para.innerHTML;
      const matches = text.matchAll(regex);
      for (const match of matches) {
        result.push(match[1]); // [0] includes non capturing groups
      }
    }
  }
  return result;
}
