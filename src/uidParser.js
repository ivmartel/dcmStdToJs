import {
  getSelector,
  parseTableNode
} from './genericParser.js';

/**
 * @import {DicomParseResult} from './parser.js';
 */

/**
 * DICOM UID class.
 */
export class DicomUID {
  /**
   * @type {string}
   */
  name;
  /**
   * @type {string}
   */
  keyword;
  /**
   * @type {string}
   */
  value;
}

/**
 * Parse a PS3.6 node: Data Dictionary.
 * See: {@link https://dicom.nema.org/medical/dicom/current/output/chtml/part06/PS3.6.html}.
 *
 * @param {Document} partNode The main DOM node.
 * @param {string} [origin] Optional node origin.
 * @returns {DicomParseResult[]} The parse results.
 */
export function parsePs36UIDNode(partNode, origin) {
  // transfer syntax
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part06/chapter_A.html#table_A-1
  const uids = parseUidTableNode(
    partNode.querySelector(getSelector('table_A-1')),
    partNode,
    'UID Values',
    'Transfer Syntax');
  const uidsResults = {
    name: 'Transfer syntax UIDs',
    origin: origin,
    raw: uids,
    data: JSON.stringify(simplifyUids(adaptUidsForDwv(uids)), null, '  ')
  };

  // standard SOPs class
  // https://dicom.nema.org/medical/dicom/current/output/chtml/part06/chapter_A.html#table_A-1
  const sops = parseUidTableNode(
    partNode.querySelector(getSelector('table_A-1')),
    partNode,
    'UID Values',
    'SOP Class',
    new RegExp('^1.2.840.10008.5.1.4.1.1.')
  );
  const sopsResults = {
    name: 'Standard SOP class',
    origin: origin,
    raw: sops,
    data: JSON.stringify(simplifyUids(adaptUidsForDwv(sops)), null, '  ')
  };

  return [uidsResults, sopsResults];
}

/**
 * Parse UID values as array and return a UID object.
 *
 * @param {string[][]} properties A UID row array of properties (length=6).
 * @param {string} uidType The UID type.
 * @returns {DicomUID} The UID object.
 */
function uidPropertiesToObject(properties, uidType) {
  // check length (then only use the first element of each item)
  if (properties.length !== 4 && properties.length !== 5) {
    throw new Error('Not the expected UID values size: ' + properties.length);
  }
  let uid = null;
  // check UID type
  // a 'UID keyword' column was added in 2020d, use len-2 instead of index
  if (properties[properties.length - 2][0].includes(uidType)) {
    uid = {
      value: properties[0][0],
      name: properties[1][0],
      keyword: properties[2][0]
    };
  }
  return uid;
}

/**
 * Parse a DICOM standard XML UIDs table node.
 *
 * @param {Element} tableNode A DOM table node.
 * @param {Document} partNode The main DOM node.
 * @param {string} expectedCaption The expected node caption.
 * @param {string} uidType The UID type.
 * @param {RegExp} [uidRegex] Optional UID regex.
 * @returns {DicomUID[]} The list of
 *   transfer syntax UIDs.
 */
function parseUidTableNode(
  tableNode, partNode, expectedCaption, uidType, uidRegex) {
  if (typeof uidRegex === 'undefined') {
    uidRegex = new RegExp('');
  }
  const values = parseTableNode(tableNode, partNode, expectedCaption);
  const uids = [];
  for (const value of values) {
    const uid = uidPropertiesToObject(value, uidType);
    if (uid && uid.value.match(uidRegex)) {
      uids.push(uid);
    }
  }
  return uids;
}

/**
 * Adapt UIDs:
 *   - replace '&amp;' in name with '&',
 *   - remove comments in name: string after ':'.
 *
 * @param {DicomUID[]} inputUids An list of UIDs.
 * @returns {DicomUID[]} The adapted UIDs as a new list.
 */
function adaptUidsForDwv(inputUids) {
  for (const uid of inputUids) {
    let name = uid.name;
    // replace '&amp'
    if (name.includes('&amp;')) {
      name = name.replace('&amp;', '&');
      uid.name = name;
    }
    // remove comment
    if (name.includes(':')) {
      const pos = name.indexOf(':');
      uid.name = name.substring(0, pos);
    }
  }

  return inputUids;
}

/**
 * Simplify uids.
 *
 * @param {DicomUID[]} uids The UIDs.
 * @returns {Record<string, string>} Simplified uids indexed by value.
 */
function simplifyUids(uids) {
  /** @type {Record<string, string>} */
  const res = {};
  for (const uid of uids) {
    res[uid.value] = uid.keyword;
  }
  return res;
}